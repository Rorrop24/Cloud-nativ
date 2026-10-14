import json
import os
import re
import sys
import tempfile
from pathlib import Path


def write_environment(target, values):
    if target.is_symlink():
        raise ValueError("No se admiten enlaces simbolicos en archivos de entorno")
    lines = []
    for key, value in values.items():
        if not re.fullmatch(r"[A-Z][A-Z0-9_]*", key) or not isinstance(value, str) or any(
            character in value for character in "\n\r\x00"
        ):
            raise ValueError("Configuracion de entorno invalida")
        lines.append(f"{key}={value}\n")
    descriptor, staging = tempfile.mkstemp(prefix=".environment-", dir=target.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as destination:
            destination.writelines(lines)
        os.replace(staging, target)
    finally:
        if os.path.exists(staging):
            os.unlink(staging)


def configure(config, response, directory):
    if response.get("InvalidParameters"):
        raise ValueError("Faltan SecureString requeridos")
    parameters = {item["Name"]: item for item in response.get("Parameters", [])}
    secrets = {}
    for kind, pattern in (("database", r"[A-Za-z0-9]{32,41}"), ("rabbit", r"[A-Za-z0-9_-]{32,128}")):
        item = parameters.get(config[f"{kind}_password_path"], {})
        if item.get("Type") != "SecureString" or not re.fullmatch(pattern, item.get("Value", "")):
            raise ValueError("SecureString ausente o formato no permitido")
        secrets[kind] = item["Value"]
    backend = {**config["backend"], "DB_PASSWORD": secrets["database"], "RABBITMQ_PASSWORD": secrets["rabbit"]}
    write_environment(directory / "backend.env", backend)
    write_environment(directory / "bff.env", config["bff"])


if __name__ == "__main__":
    with open(sys.argv[1], encoding="utf-8") as source:
        configuration = json.load(source)
    with open(sys.argv[2], encoding="utf-8") as source:
        parameters = json.load(source)
    configure(configuration, parameters, Path(sys.argv[3]))
