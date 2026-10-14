# Punto Gamer: base de datos AWS sin wallet

La opcion nueva es Amazon RDS MySQL 8.4. El backend tiene un perfil `aws`;
el BFF consulta al backend y no necesita credenciales de base de datos.
React/Angular y Azure Entra ID no cambian. Oracle queda intacto como opcion anterior.

## Despliegue verificado

RDS creado y verificado en estado `available` el 14-10-2026 UTC (13-10 en Chile),
cuenta `406875243411`, region `us-east-1`. Parametros `in-sync`, sin cambios pendientes.

| Recurso | Valor actual |
| --- | --- |
| Instancia RDS | punto-gamer-dev-mysql |
| Motor / clase | MySQL 8.4.11 / db.t3.micro |
| Base / usuario inicial | punto_gamer / punto_gamer |
| Endpoint privado | punto-gamer-dev-mysql.cyvovcoqgbie.us-east-1.rds.amazonaws.com:3306 |
| VPC nueva | vpc-0f2d1a78e2f3887c6 |
| Grupo que debe llevar la EC2 del backend | sg-0d4d8f172ceea3941 |
| Grupo RDS | sg-06b57dae430e41422 |
| Secreto SSM | /punto-gamer/dev/database/password |

Se verificaron cifrado, acceso no publico, backups de 7 dias, proteccion de borrado
y `require_secure_transport = 1`. La password no se muestra en esta guia.
No hay EC2 de aplicacion desplegada: todavia no se ha probado una conexion JDBC
real ni se han ejecutado las migraciones en RDS. La base empieza vacia.
La VPC/EC2 RabbitMQ anterior ya no existian en AWS; sus outputs antiguos pueden
seguir en el estado local tras este apply dirigido. No uses esas IP/IDs.

## 1. Crear RDS desde tu computador

Renueva primero las credenciales temporales de AWS Academy/Learner Lab en AWS CLI,
incluyendo el session token. No compartas claves, passwords ni tokens en el chat.
Desde PowerShell en la carpeta del proyecto:

```powershell
cd C:\Users\rorro\Desktop\CloudNative
aws sts get-caller-identity --query Account --output text
.\infra\deploy\Deploy-Database.ps1 -Mode Plan
terraform -chdir=infra/terraform show database.tfplan
```

La primera consulta debe devolver tu cuenta `406875243411`. Si aparece
`ExpiredToken`, renueva la sesion antes de continuar. Se necesita Terraform 1.11+.
Si Windows bloquea scripts, usa una terminal PowerShell con una politica permitida
por tu equipo; no deshabilites politicas corporativas.

El script lee la cuenta/region configuradas en `infra/terraform/terraform.tfvars`.
Usa `enable_database = true`, `database_name = "punto_gamer"`,
`database_username = "punto_gamer"` y `database_instance_class = "db.t3.micro"`.
Esos tres ultimos valores tienen defaults; no necesitas escribir una password.

Revisa el plan y los creditos del laboratorio. Crea RDS, dos subredes privadas,
su tabla/asociaciones de rutas, grupo de subredes, grupo de parametros y regla 3306.
Incluye la regla de salida del grupo del backend para que pueda conectarse.
RDS tiene costos; tambien pueden tenerlos sus respaldos y almacenamiento.
Cuando estes conforme:

```powershell
.\infra\deploy\Deploy-Database.ps1 -Mode Apply
terraform -chdir=infra/terraform output database_environment
terraform -chdir=infra/terraform output backend_environment
```

Crear RDS puede tardar varios minutos. No cierres Terraform mientras aplica.
El modo Plan crea un SecureString si no existe, pero no crea RDS. Apply crea RDS.
Si un apply falla parcialmente, conserva el estado y genera un plan nuevo;
no ejecutes `destroy` para reintentar.

Este script usa `-target=aws_db_instance.mysql` solo para esta incorporacion:
el `user_data` de RabbitMQ tiene una correccion pendiente que un apply completo
podria convertir en reemplazo de su EC2. El script bloquea borrados/reemplazos
y cambios ajenos a los tipos de recursos permitidos para la BD. No uses targeting
como sustituto permanente de revisar el plan completo de la infraestructura.
Los outputs de un apply dirigido pueden quedar incompletos; verifica tambien
`terraform state show 'aws_db_instance.mysql[0]'` si falta el endpoint.
Si AWS indica que la VPC/EC2 anterior fue eliminada fuera de Terraform (por ejemplo,
un reinicio del laboratorio), algunos outputs antiguos de RabbitMQ/subred publica
pueden seguir en el estado local. No reutilices sus IP/IDs: primero reconcilia
el despliegue completo y comprueba los recursos actuales en AWS.

## 2. Que queda protegido

- RDS no tiene acceso publico. Solo el grupo `backend_security_group_id` entra por 3306.
- Dos subredes en AZ distintas, sin ruta al Internet Gateway; no requieren NAT para RDS.
- Almacenamiento gp3 cifrado: 20 GiB, crecimiento maximo a 50 GiB.
- Backups de 7 dias, proteccion contra borrado y snapshot final al eliminar.
- Single-AZ para esta demostracion: las dos subredes no significan alta disponibilidad.
- TLS obligatorio en MySQL; Java verifica el certificado y el nombre DNS (`VERIFY_IDENTITY`).

El script genera una password aleatoria de 40 caracteres (limite MySQL: 41)
y la guarda en SSM Parameter Store como
SecureString en `/punto-gamer/dev/database/password`, usando la clave administrada
de SSM. Si ya existe, la reutiliza. La password se pasa a Terraform con una variable
efimera y `password_wo`: no se guarda en el estado ni en el plan Terraform.
El temporal local tiene ACL privada y se elimina al terminar. El valor si existe
en SSM, en la memoria del proceso y, despues, en el entorno protegido del backend.
El parametro SSM no esta administrado como recurso Terraform.

No edites/elimines ese parametro ni incrementes `database_password_version`
sin un procedimiento coordinado de rotacion de RDS y del backend. El script
rechaza Apply si el parametro cambio desde Plan. Conserva planes y estado fuera de Git.

El usuario inicial de RDS permite a Flyway crear tablas para la entrega.
En produccion usa una credencial separada para migraciones y un usuario de
aplicacion con permisos limitados; el ejemplo no implementa esa separacion.

## 3. Preparar el backend

Compila el JAR desde tu computador, con JDK 17+:

```powershell
cd C:\Users\rorro\Desktop\CloudNative\Backend
.\mvnw.cmd verify
cd ..
docker build -t punto-gamer-backend:aws .\Backend
```

Docker debe estar iniciado. El Dockerfile importa las CA **publicas** de RDS
en Java al construir la imagen. No es un wallet ni un certificado de cliente.
Si ejecutas el JAR fuera de esa imagen, debes configurar esas CA en su truststore.
No cambies a `sslMode=DISABLED` para resolver un error de certificado.

Transfiere la imagen/JAR y el script `infra/deploy/Configure-BackendDatabase.sh`
a la **EC2 de aplicacion**, mediante tu mecanismo de transferencia autorizado.
Esta EC2 debe estar en la misma VPC y llevar el grupo que muestra
`terraform output -raw backend_security_group_id`. Debe tener Docker, AWS CLI,
Python 3 y un instance profile autorizado para leer/descifrar ambos SecureString.
En Learner Lab se usa `LabInstanceProfile` si sus permisos lo permiten.
El rol propio de RabbitMQ solo lee sus dos parametros; no sirve para leer la BD.

Dentro de esa EC2, usa el endpoint que aparece en `database_environment`:

```bash
sudo bash Configure-BackendDatabase.sh us-east-1 ENDPOINT_RDS punto_gamer punto_gamer \
  /punto-gamer/dev/database/password /punto-gamer/dev/rabbitmq/password
sudo nano /etc/punto-gamer/backend.env
```

El script escribe un archivo root/600 sin mostrar los secretos. En nano agrega
los valores de RabbitMQ que entrega `backend_environment` y el dominio web:

```dotenv
RABBITMQ_ADDRESSES=IP_PRIVADA_RABBITMQ:5672,IP_PRIVADA_RABBITMQ:5673,IP_PRIVADA_RABBITMQ:5674
RABBITMQ_USERNAME=levelup
RABBITMQ_VHOST=levelup
ALLOWED_ORIGINS=https://TU_DOMINIO_WEB
```

Reemplaza IP_PRIVADA_RABBITMQ por la IP de un broker que exista en la VPC nueva.
El dashboard RabbitMQ solo escucha en loopback en la configuracion actual:
La variable `RABBITMQ_MANAGEMENT_URL` requiere configurar su acceso privado desde el backend
antes de usar administracion remota; no abras 15672 al Internet.
No ejecutes `source backend.env`: la URL JDBC contiene `&` y es un env-file de Docker.
Arranca el backend sin publicar su API a Internet:

```bash
sudo docker run -d --name punto-gamer-backend --restart unless-stopped \
  --env-file /etc/punto-gamer/backend.env \
  -p 127.0.0.1:8082:8082 punto-gamer-backend:aws
sudo docker logs --tail 80 punto-gamer-backend
curl --fail http://127.0.0.1:8082/health
```

El puerto loopback sirve para BFF/proxy ejecutados en el mismo host. Un BFF en
otro contenedor necesita una red Docker compartida y la URL interna del servicio;
`localhost` dentro de otro contenedor no es este backend. Un ALB remoto requiere
otro enlace de puerto y reglas restringidas al grupo del ALB, no un puerto publico.

Flyway crea 8 tablas y su historial en el primer arranque; Hibernate valida el
esquema. Para verificar datos, crea un producto desde la API autenticada,
consultalo, reinicia el backend y vuelve a consultarlo. `/health` solo demuestra
que responde HTTP, no reemplaza esa prueba de persistencia.

## 4. Limites y siguientes pasos

Esta BD empieza vacia: no importa usuarios/productos de Oracle ni inserta datos
ficticios. Conserva Oracle hasta exportar/importar lo necesario de forma controlada.
Ahora se incorporo el despliegue completo: seguir [aws-despliegue-completo.md](aws-despliegue-completo.md)
para crear la EC2 de aplicacion y publicar React/API. Crear RDS por si solo no publica la tienda.
Azure/MSAL y las validaciones JWT siguen siendo necesarias para la rubrica.

Los tests locales incluyen H2 en modo MySQL y pruebas Terraform con AWS simulado.
Hay dos pruebas adicionales con MySQL 8.4 real via Testcontainers; se omiten si
Docker no esta disponible. Para ejecutarlas: iniciar Docker y ejecutar
`./mvnw.cmd -Dtest=MySqlIntegrationTest test` desde Backend. Esas pruebas no
demuestran la conexion TLS/SSM real en AWS; esa validacion se hace en la EC2.

Para borrar RDS al terminar la entrega hay que desactivar conscientemente
`database_deletion_protection`, aplicar ese cambio y conservar el snapshot final.
No cambies `enable_database` a false ni destruyas toda la red sin respaldos y plan.
Los snapshots y el SecureString no desaparecen automaticamente al borrar la BD.

## Referencias

- [RDS MySQL en una VPC](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_VPC.WorkingWithRDSInstanceinaVPC.html)
- [Exigir TLS en RDS MySQL](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/mysql-ssl-connections.require-ssl.html)
- [Certificados RDS para clientes Java](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/ssl-certificate-rotation-mysql.html)
- [Variables efimeras Terraform](https://developer.hashicorp.com/terraform/language/manage-sensitive-data/ephemeral)
- [Limites de password por motor RDS](https://docs.aws.amazon.com/AmazonRDS/latest/APIReference/API_CreateDBInstance.html)
- [Costos de RDS MySQL](https://aws.amazon.com/rds/mysql/pricing/)
