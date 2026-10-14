#!/usr/bin/env bash
set -euo pipefail
umask 077

if [[ "$EUID" != 0 || "$#" -ne 6 ]]; then
  echo "Uso (EC2 de aplicacion): sudo bash $0 REGION ENDPOINT_RDS DB_NOMBRE DB_USUARIO DB_PASSWORD_PATH RABBIT_PASSWORD_PATH" >&2
  exit 1
fi

region="$1"
endpoint="$2"
database="$3"
username="$4"
database_password_path="$5"
rabbit_password_path="$6"

[[ "$region" =~ ^[a-z]{2}-[a-z]+-[0-9]+$ ]] || { echo "Region invalida" >&2; exit 1; }
[[ "$endpoint" =~ ^[a-zA-Z0-9.-]+\.rds\.amazonaws\.com(\.cn)?$ ]] || { echo "Endpoint RDS invalido" >&2; exit 1; }
[[ "$database" =~ ^[A-Za-z][A-Za-z0-9_]{0,63}$ ]] || { echo "Nombre de BD invalido" >&2; exit 1; }
[[ "$username" =~ ^[A-Za-z][A-Za-z0-9_]{0,15}$ ]] || { echo "Usuario de BD invalido" >&2; exit 1; }
command -v aws >/dev/null
command -v python3 >/dev/null

temporary_directory="$(mktemp -d /var/tmp/punto-gamer-db.XXXXXXXX)"
trap 'rm -f "$temporary_directory/parameters.json"; rmdir "$temporary_directory"' EXIT

# El rol de ESTA EC2 debe poder leer y descifrar ambos SecureString.
aws ssm get-parameters --region "$region" --with-decryption \
  --names "$database_password_path" "$rabbit_password_path" \
  --output json > "$temporary_directory/parameters.json"

install -d -m 700 /etc/punto-gamer
python3 - "$temporary_directory/parameters.json" "$endpoint" "$database" "$username" \
  "$database_password_path" "$rabbit_password_path" <<'PY'
import json
import os
import re
import sys
import tempfile
from pathlib import Path

path, endpoint, database, username, database_path, rabbit_path = sys.argv[1:]
with open(path, encoding="utf-8") as source:
    response = json.load(source)
if response.get("InvalidParameters"):
    raise SystemExit("Faltan parametros SSM; el archivo de entorno no se ha modificado.")
parameters = {item["Name"]: item for item in response["Parameters"]}
for name, pattern in ((database_path, r"[A-Za-z0-9]{32,41}"),
                      (rabbit_path, r"[A-Za-z0-9_-]{32,128}")):
    item = parameters.get(name, {})
    if item.get("Type") != "SecureString" or not re.fullmatch(pattern, item.get("Value", "")):
        raise SystemExit("Un SecureString esta ausente o no tiene el formato esperado.")
updates = {
    "SPRING_PROFILES_ACTIVE": "aws",
    "DB_URL": f"jdbc:mysql://{endpoint}:3306/{database}?sslMode=VERIFY_IDENTITY&serverTimezone=UTC&characterEncoding=UTF-8",
    "DB_USERNAME": username,
    "DB_PASSWORD": parameters[database_path]["Value"],
    "RABBITMQ_PASSWORD": parameters[rabbit_path]["Value"],
}
target = Path("/etc/punto-gamer/backend.env")
if target.is_symlink():
    raise SystemExit("El archivo de entorno no puede ser un enlace simbolico.")
# Preserva Azure, las direcciones RabbitMQ y otras variables ya configuradas.
lines = target.read_text(encoding="utf-8").splitlines() if target.exists() else []
lines = [line for line in lines if line.partition("=")[0] not in updates]
lines.extend(f"{key}={value}" for key, value in updates.items())
descriptor, staging = tempfile.mkstemp(prefix=".backend-", dir=target.parent)
try:
    with os.fdopen(descriptor, "w", encoding="utf-8") as destination:
        destination.write("\n".join(lines) + "\n")
    os.replace(staging, target)
finally:
    if os.path.exists(staging):
        os.unlink(staging)
PY

echo "Configuracion escrita en /etc/punto-gamer/backend.env (root, modo 600)."
echo "Falta configurar RABBITMQ_ADDRESSES y arrancar el backend con --env-file."
