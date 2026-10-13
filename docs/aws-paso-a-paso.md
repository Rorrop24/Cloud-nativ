# Punto Gamer: guia de despliegue AWS paso a paso

Esta guia explica el proyecto y el camino para desplegarlo. Sus comandos son
instrucciones para ejecutar despues: no se han creado recursos AWS al escribirla.

## 1. Que hace cada componente

| Componente | Funcion real | Donde se ejecuta |
| --- | --- | --- |
| Frontend/ | Tienda React: productos, carrito, perfil y administracion | Navegador; archivos publicados en S3/CloudFront |
| FrontendAngular/ | Base separada de cuenta/catalogo y ejemplo MSAL Angular | Navegador; otro sitio S3/CloudFront |
| MSAL | Redirige a Microsoft, gestiona la sesion y obtiene/renueva access tokens | Navegador |
| Azure Entra ID | Autentica a las personas y emite tokens firmados | Azure, no EC2 |
| BffJava/ | Valida JWT, agrega catalogo y reenvia el bearer al backend | EC2, puerto 8084 |
| Backend/ | API de negocio, autorizacion, usuarios, productos, boletas y eventos | EC2, puerto 8082 |
| JPA y repositorios | Traducen operaciones Java a consultas en Oracle | Dentro del backend |
| Oracle Cloud | Persiste los datos de la tienda | Oracle Cloud, no AWS |
| RabbitMQ | Transporta eventos y los entrega a consumidores; mantiene DLQ | EC2 dedicada; tres contenedores |
| Terraform | Crea VPC, IGW, subred publica, rutas, grupos de seguridad y EC2 RabbitMQ con disco/IAM | Se ejecuta desde tu computador |
| SSM | Permite administrar EC2 sin abrir SSH y almacenar parametros | AWS |
| ALB interno | Distribuye llamadas al Backend o al BFF segun la ruta | AWS, dentro de la VPC |
| API Gateway | Punto de entrada HTTPS para las APIs | AWS |
| S3 y CloudFront | Guardan y sirven los archivos de los frontends por HTTPS | AWS |

El BFF Node de bff-service/ no es el que debes usar como entrada segura.
Conservamos ese codigo anterior; la implementacion JWT nueva esta en BffJava/.

"Todo en AWS" aqui significa desplegar la aplicacion y RabbitMQ en AWS.
Azure sigue siendo el proveedor de identidad y Oracle la base de datos.
Migrar esos dos servicios a Cognito/RDS seria otra tarea, no una configuracion
equivalente del codigo actual.

## 2. Como viaja una solicitud

1. El usuario abre React o Angular desde CloudFront.
2. MSAL redirige a Azure cuando la vista requiere login.
3. Azure devuelve el resultado del flujo; MSAL obtiene un access token para tu API.
4. El frontend envia Authorization: Bearer <access-token> a API Gateway.
5. Gateway llega al ALB mediante VPC Link.
6. El ALB manda /api/bff/* al BFF y /v2/* o /api/* al backend.
7. Cada servicio Java comprueba firma, expiracion, issuer y audience.
8. Spring comprueba scopes/roles; para datos personales tambien comprueba propiedad.
9. El backend usa Oracle y publica eventos RabbitMQ segun la operacion.

React conserva acceso publico GET al catalogo. El catalogo agregado del BFF
requiere una sesion con Pedidos.Read o Rabbit.Admin.

401 significa token ausente o invalido. 403 significa token valido sin permiso.
El rol de administrador de la base de datos no reemplaza el app role de Azure.

## 3. Arquitectura para esta entrega

```text
Internet
  |
  +-- CloudFront React ------ S3 privado React
  +-- CloudFront Angular ---- S3 privado Angular (opcional)
  |
  +-- API Gateway HTTPS
          |
        VPC Link
          |
        ALB interno
          |
        EC2 aplicacion
          +-- Backend Java :8082 ---- Oracle Cloud
          +-- BFF Java :8084
          |
        EC2 RabbitMQ
          +-- rabbitmq-1 :5672
          +-- rabbitmq-2 :5673
          +-- rabbitmq-3 :5674

Login de ambos frontends -> Azure Entra ID
```

Puedes alojar ambos procesos Java en una EC2 para la demostracion.
Esto no proporciona alta disponibilidad de la aplicacion. Los tres nodos
RabbitMQ tampoco toleran la perdida de su unica EC2.

Usar una region, por ejemplo us-east-1, y una sola VPC para esta arquitectura.
El ALB requiere subnets en al menos dos zonas de disponibilidad.
Terraform crea una sola subred publica; agregar una segunda en otra AZ de la
misma VPC antes de crear el ALB.
Backend y RabbitMQ necesitan salida para paquetes, Azure, AWS y Oracle.
Una subnet privada requiere NAT o la conectividad/endpoints apropiados;
no basta con desactivar la IP publica.

Para una demo puede usarse una EC2 con IP publica y acceso entrante cerrado,
administrada solo por SSM. No confundir "tener IP publica" con permitir puertos
abiertos. NAT, ALB, EC2, EBS, IPs publicas y otros recursos pueden generar costos:
configura un presupuesto y revisa creditos antes de aplicar.

## 4. Preparar el computador y la cuenta

1. Instalar JDK 17+; el proyecto se verifico con JDK 21.
2. Usar Node compatible con cada package.json; Node 24.15+ de la rama 24 sirve
   para la base Angular actual.
3. Instalar Terraform 1.10+ y AWS CLI v2.
4. Instalar Session Manager Plugin para las sesiones y los tuneles.
5. Configurar una sesion AWS del proyecto, preferiblemente con credenciales
   temporales/SSO. No usar las credenciales del usuario root.
6. Comprobar cuenta y region antes de cualquier plan.

En PowerShell:

```powershell
aws --version
terraform version
aws sts get-caller-identity
aws configure get region
```

AWS CLI debe mostrar version 2. Si aparece InvalidClientTokenId o
ExpiredToken, renovar la sesion antes de seguir. Credenciales temporales
requieren tambien el session token; no basta con access key y secret key.
No pegues claves en el chat, Git ni terraform.tfvars.

En AWS Academy/Learner Lab, revisar restricciones antes de aplicar: el
Terraform puede reutilizar un perfil existente autorizado, evitando iam:CreateRole:

```hcl
existing_instance_profile_name = "LabInstanceProfile"
```

Usar ese nombre solo si existe en tu laboratorio. El perfil debe permitir SSM y
leer/descifrar los parametros RabbitMQ; el usuario sigue necesitando iam:PassRole.
En ese modo Terraform no crea ni modifica roles, perfiles o politicas IAM.
Sin ese input (o con null), crea su rol propio con permisos limitados al proyecto.
No intentar sustituir esa limitacion con credenciales root o permisos excesivos.

## 5. Preparar red, permisos y una EC2 de aplicacion

La VPC y la subred publica las crea Terraform en el paso 6. Preparar ahora los
permisos y, despues de aplicar ese paso, consultar `vpc_id`, `public_subnet_id`
y `backend_security_group_id` en sus outputs. Ya no se usan IDs de redes existentes.
Crear entonces una EC2 Amazon Linux 2023 x86_64 para los JAR, con capacidad suficiente
para ambos JVM; t3.medium es un punto de partida de demo, no una garantia de capacidad.
Usar la subred y el grupo del backend creados por Terraform. Para el ALB agregar
una segunda subred en otra AZ de esa misma VPC; no se crea automaticamente.

Reglas de entrada sugeridas:

| Grupo | Entrada permitida |
| --- | --- |
| sg-vpclink | Sin entrada arbitraria; salida al ALB |
| sg-alb | TCP 80 desde sg-vpclink, para integracion privada HTTP |
| sg-app (backend_security_group_id de Terraform) | Agregar TCP 8082 y 8084 solo desde sg-alb; inicialmente no tiene entrada |
| SG RabbitMQ creado por Terraform | TCP 5672, 5673 y 5674 desde sg-app |
| Dashboard RabbitMQ | Sin regla publica; esta enlazado a loopback |

No abrir 22, 8082, 8084 ni 15672 a 0.0.0.0/0.
No se necesita exponer puertos Erlang entre EC2 porque los nodos estan en
contenedores dentro de una sola instancia.

sg-app necesita salida a RabbitMQ, Oracle y HTTPS para Azure/SSM.
Consultar el host/puerto de Oracle en el wallet; la conexion mTLS suele usar
1522, pero usa el descriptor real, no una regla basada solo en esta suposicion.
Si Oracle usa ACL, permitir la IP de salida concreta de la EC2 o del NAT.
Una base con endpoint privado requiere una red privada que conecte AWS y OCI.

Crear un rol de instancia distinto del de RabbitMQ, con:
- AmazonSSMManagedInstanceCore para la administracion SSM.
- s3:GetObject solo para los JAR del bucket privado de artefactos.
- Acceso a los parametros exactos de password de BD y RabbitMQ si automatizas su lectura.
- kms:Decrypt sobre la clave concreta cuando uses KMS administrado por ti.

Los permisos del usuario que despliega y del rol de la EC2 son distintos.
El rol de RabbitMQ tiene una denegacion explicita para otros parametros;
en modo IAM propio no reutilizarlo para leer secretos de la aplicacion. Si se
reutiliza LabInstanceProfile, sus permisos existentes son externos al modulo:
no asumir que tiene esa denegacion ni modificar el rol del laboratorio.

Comprobar que la instancia aparece online en Systems Manager y abrir una sesion.
Si no aparece, revisar rol, agente SSM, DNS, salida HTTPS y rutas de la subnet.

## 6. Levantar RabbitMQ con el Terraform existente

En Parameter Store, misma cuenta/region del despliegue, crear dos SecureString:
- /punto-gamer/dev/rabbitmq/password
- /punto-gamer/dev/rabbitmq/erlang-cookie

Cada valor debe ser aleatorio, diferente, de 32 a 128 caracteres, usando
letras, numeros, guion o guion bajo. Password autentica al usuario del broker;
la cookie permite que los nodos Erlang confien entre si. El backend no necesita
la cookie.

Completar terraform.tfvars a partir del ejemplo. No poner secretos en el archivo:

```hcl
aws_account_id = "<ID_REAL_DE_12_DIGITOS>"
aws_region = "us-east-1"

project_name = "punto-gamer"
environment = "dev"
instance_type = "t3.medium"
volume_size_gib = 40
associate_public_ip_address = true
```

Terraform crea VPC 10.0.0.0/16, subred publica 10.0.1.0/24, IGW y ruta
0.0.0.0/0. La EC2 referencia directamente aws_subnet.public.id. Mantener la IP
publica habilitada: no se crea NAT. Esto no abre puertos de entrada en RabbitMQ.
La zona se selecciona entre las habilitadas que ofrecen instance_type; se puede
fijar con availability_zone = "us-east-1a", siempre que AWS la ofrezca para tu cuenta.
Se requieren ec2:DescribeAvailabilityZones y ec2:DescribeInstanceTypeOfferings.
Fijar la zona del output despues del primer despliegue evita que una nueva oferta
cambie la seleccion automatica. Las ofertas no garantizan capacidad libre.
Eliminar subnet_id y backend_security_group_ids de tfvars antiguos: esos inputs
fueron reemplazados por recursos de la nueva VPC.

```powershell
cd C:\Users\rorro\Desktop\CloudNative\infra\terraform
if (-not (Test-Path terraform.tfvars)) { Copy-Item terraform.tfvars.example terraform.tfvars }
# Comprobar cuenta y region de terraform.tfvars antes de seguir.
terraform init
terraform validate
terraform plan -out=network.tfplan
terraform show network.tfplan
# Ejecutar solo despues de revisar cuenta, recursos y costos:
terraform apply network.tfplan
terraform output
```

terraform init instala el proveedor. validate revisa la estructura.
plan propone cambios sin aplicarlos. apply crea/modifica recursos.
El estado registra los recursos administrados: protegerlo y conservarlo.
Un tfplan guardado puede incluir informacion sensible; no subirlo a Git.
No volver a copiar el ejemplo sobre una configuracion local ya completada.
No aplicar un deployment.tfplan anterior: sigue usando la configuracion antigua.
Si se configura LabInstanceProfile despues de un error iam:CreateRole, generar
un plan nuevo (por ejemplo lab.tfplan) y comprobar que ya no crea recursos IAM.
Conservar el estado del apply parcial: la red ya creada no necesita destruirse.
Si ya existia una EC2 administrada, la nueva subred requiere reemplazarla.
Respaldar los datos RabbitMQ antes de aprobar cualquier reemplazo; las EC2
existentes no se migran automaticamente a la nueva VPC.
Si AWS rechaza t3.medium en la zona de la subred, cambiar availability_zone a una
compatible y generar otro plan (por ejemplo zone.tfplan). Esto reemplaza la subred
y su asociacion, no mueve recursos existentes. No aplicar si otras EC2/ALB usan
esa subred sin preparar primero su migracion. No reducir RAM para evitar este error.

La EC2 puede aparecer running antes de que RabbitMQ haya terminado de instalarse.
Entrar por SSM y comprobar:

```bash
sudo systemctl status punto-gamer-rabbitmq
sudo journalctl -u punto-gamer-rabbitmq --no-pager -n 80
sudo docker compose -f /opt/punto-gamer/rabbitmq/compose.yml ps
sudo docker compose -f /opt/punto-gamer/rabbitmq/compose.yml exec -T rabbitmq-1 rabbitmqctl cluster_status
```

Esperar los tres nodos running antes de iniciar consumidores.
Consultar terraform output backend_environment para las direcciones AMQP.

El tunel al dashboard lo entrega:

```powershell
terraform output -raw management_tunnel_command
```

Ejecutar el comando devuelto y dejar el tunel abierto; entonces abrir
http://localhost:15672/. Esa direccion es de tu computador, no un acceso publico.
Conectar con levelup y la password del SecureString.

No cambiar una password/cookie en SSM esperando que rote automaticamente un
broker ya inicializado. Respaldar datos y seguir un procedimiento de rotacion.

## 7. Preparar Azure Entra ID

No se crea Azure con este Terraform.

En Entra ID -> App registrations:

1. Verificar/crear un registro de la API y un registro SPA.
2. Anotar Tenant ID, Client ID de la API y Client ID de la SPA por separado.
3. En el registro de API, establecer api.requestedAccessTokenVersion en 2.
4. En Expose an API, usar Application ID URI api://<API_CLIENT_ID>
   y crear el scope delegado Pedidos.Read.
5. En el registro SPA, agregar ese permiso delegado y el consentimiento necesario.
6. Crear el app role Rabbit.Admin en el registro de la API, habilitado para User.
7. En Enterprise applications de la API, asignar ese rol a tu usuario administrador.
8. En el registro SPA, Authentication, registrar cada URL final de CloudFront
   como redirect URI de tipo Single-page application. Agregar tambien localhost
   si vas a seguir probando en desarrollo.
9. Configurar el claim opcional email del access token si tu token no incluye
   preferred_username, para poder crear el perfil local.

El clientId de MSAL es el de la SPA. AZURE_API_AUDIENCE es el de la API.
No usar el mismo identificador por comodidad si son registros diferentes.
No introducir client secrets en React/Angular.

Variables comunes a ambos Java:

```dotenv
AZURE_ISSUER_URI=https://login.microsoftonline.com/<TENANT_ID>/v2.0
AZURE_JWK_SET_URI=https://login.microsoftonline.com/<TENANT_ID>/discovery/v2.0/keys
AZURE_API_AUDIENCE=<API_CLIENT_ID>
ALLOWED_ORIGINS=https://<FRONT_REACT>,https://<FRONT_ANGULAR>
```

Quitar el segundo origin si no publicas Angular. Los origins no llevan
rutas ni barra final. Las redirect URIs si deben coincidir con las del codigo:
Angular usa origin + "/", React usa origin.

Los IDs iniciales del proyecto no son evidencia de que esos registros tengan
ya todos los permisos configurados. Verificarlos en tu tenant.

## 8. Preparar Oracle Cloud

1. Confirmar que la base esta disponible y que contiene el esquema de la tienda.
   ddl-auto=validate no crea una base ni sus tablas.
2. Descargar el wallet por el canal seguro de Oracle.
3. Transferirlo de forma privada y dejarlo en una ruta legible por el usuario
   del servicio, por ejemplo /etc/punto-gamer/wallet, nunca dentro del sitio S3.
4. Revisar sqlnet.ora y cualquier ruta del wallet para que correspondan a Linux.
5. Tomar respaldo y aplicar una sola vez la migracion
   Backend/src/main/resources/db/azure-identity-oracle.sql.
6. Usar un usuario de aplicacion con permisos limitados, no ADMIN en produccion.
7. Guardar su password como secreto; comprobar conectividad desde la EC2 app.

Configuracion de backend:

```dotenv
SPRING_PROFILES_ACTIVE=cloud
DB_URL=jdbc:oracle:thin:@tiendalevelup_low?TNS_ADMIN=/etc/punto-gamer/wallet
DB_USERNAME=<USUARIO_DE_LA_APLICACION>
DB_PASSWORD=<PASSWORD_PRIVADA>
```

tiendalevelup_low es el alias del tnsnames.ora del proyecto; sustituirlo por
el alias real de tu wallet si es distinto. El driver y dialecto son Oracle:
no apuntar esta URL a RDS PostgreSQL/MySQL sin una migracion del proyecto.

Si un email ya existe sin azure_subject, sync-azure devuelve 409.
Verificar tid y oid del usuario real y vincularlo administrativamente antes
de reutilizar esa cuenta. No resolverlo borrando cuentas o quitando la validacion.

## 9. Compilar y transferir los JAR

En PowerShell, dentro de cada carpeta:

```powershell
cd C:\Users\rorro\Desktop\CloudNative\Backend
./mvnw.cmd verify
cd C:\Users\rorro\Desktop\CloudNative\BffJava
./mvnw.cmd verify
```

Resultados:
- Backend/target/TiendaLevelUp-0.0.1-SNAPSHOT.jar
- BffJava/target/punto-gamer-bff-1.0.0.jar

Crear/reutilizar un bucket PRIVADO de artefactos, separado del frontend.
Subir solo los JAR. No subir el wallet ni .env con sync de la carpeta completa.
Ejemplo, sustituyendo el nombre del bucket:

```powershell
aws s3 cp C:\Users\rorro\Desktop\CloudNative\Backend\target\TiendaLevelUp-0.0.1-SNAPSHOT.jar s3://<BUCKET_ARTEFACTOS>/deploy/backend.jar
aws s3 cp C:\Users\rorro\Desktop\CloudNative\BffJava\target\punto-gamer-bff-1.0.0.jar s3://<BUCKET_ARTEFACTOS>/deploy/bff.jar
```

En una sesion SSM de la EC2 APP, no de la EC2 RabbitMQ:

```bash
sudo dnf install -y java-21-amazon-corretto-headless awscli-2
java -version
sudo useradd --system --home-dir /opt/punto-gamer --shell /sbin/nologin punto-gamer
sudo install -d -m 755 /opt/punto-gamer
sudo install -d -m 700 /etc/punto-gamer
sudo aws s3 cp s3://<BUCKET_ARTEFACTOS>/deploy/backend.jar /opt/punto-gamer/backend.jar
sudo aws s3 cp s3://<BUCKET_ARTEFACTOS>/deploy/bff.jar /opt/punto-gamer/bff.jar
sudo chmod 644 /opt/punto-gamer/backend.jar /opt/punto-gamer/bff.jar
```

Crear el usuario solo una vez; si ya existe, no repetir useradd.
Para el wallet usar un subdirectorio con permisos que permitan leer sus
archivos al usuario punto-gamer. El directorio /etc/punto-gamer de 700 root
debe permitir travesia a ese usuario para alcanzar el wallet: usar
root:punto-gamer y 750 en ese directorio, 750 en el wallet y 640 en sus archivos.
Los archivos .env permanecen root:root 600; systemd los lee antes de cambiar usuario.

## 10. Configurar Backend y BFF en la EC2

Spring no carga archivos .env automaticamente. Crear archivos de configuracion
para EnvironmentFile de systemd, fuera del repositorio:
- /etc/punto-gamer/backend.env
- /etc/punto-gamer/bff.env

backend.env debe tener:

```dotenv
SERVER_PORT=8082
SPRING_PROFILES_ACTIVE=cloud
DB_URL=jdbc:oracle:thin:@tiendalevelup_low?TNS_ADMIN=/etc/punto-gamer/wallet
DB_USERNAME=<USUARIO_REAL>
DB_PASSWORD="<SECRETO_REAL_NO_VERSIONADO>"
RABBITMQ_ADDRESSES=<IP_PRIVADA_RABBIT>:5672,<IP_PRIVADA_RABBIT>:5673,<IP_PRIVADA_RABBIT>:5674
RABBITMQ_USERNAME=levelup
RABBITMQ_VHOST=levelup
RABBITMQ_PASSWORD="<MISMO_SECRETO_PASSWORD_DE_RABBIT>"
AZURE_ISSUER_URI=https://login.microsoftonline.com/<TENANT_ID>/v2.0
AZURE_JWK_SET_URI=https://login.microsoftonline.com/<TENANT_ID>/discovery/v2.0/keys
AZURE_API_AUDIENCE=<API_CLIENT_ID>
ALLOWED_ORIGINS=https://<FRONT_REACT>,https://<FRONT_ANGULAR>
```

bff.env debe tener:

```dotenv
SERVER_PORT=8084
BACKEND_URL=http://127.0.0.1:8082
AZURE_ISSUER_URI=https://login.microsoftonline.com/<TENANT_ID>/v2.0
AZURE_JWK_SET_URI=https://login.microsoftonline.com/<TENANT_ID>/discovery/v2.0/keys
AZURE_API_AUDIENCE=<API_CLIENT_ID>
ALLOWED_ORIGINS=https://<FRONT_REACT>,https://<FRONT_ANGULAR>
```

Usar 127.0.0.1 solo porque ambos JAR estan en la MISMA instancia. Si los separas,
usar la direccion privada del backend y ajustar sus security groups.

Para una demo, los secretos pueden introducirse en estos archivos protegidos
desde el gestor de secretos. No ponerlos en una linea de shell que quede en historial.
Si contienen caracteres especiales, respetar el formato/escape de EnvironmentFile.
Para operacion continua, automatizar su lectura desde SSM/Secrets Manager con
el rol de instancia a un archivo de runtime protegido; no se implemento ese
bootstrap de secretos para los JAR. Guardar un SecureString no lo inyecta en Java.

Ejemplo de /etc/systemd/system/punto-gamer-backend.service:

```ini
[Unit]
Description=Punto Gamer Backend
Wants=network-online.target
After=network-online.target

[Service]
User=punto-gamer
Group=punto-gamer
WorkingDirectory=/opt/punto-gamer
EnvironmentFile=/etc/punto-gamer/backend.env
ExecStart=/usr/bin/java -Xms128m -Xmx768m -jar /opt/punto-gamer/backend.jar
Restart=on-failure
RestartSec=10
StateDirectory=punto-gamer
Environment=MESSAGING_OUTPUT_DIR=/var/lib/punto-gamer/events
UMask=0077
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
```

Para punto-gamer-bff.service usar la misma estructura, cambiando:
Description=Punto Gamer BFF, EnvironmentFile=/etc/punto-gamer/bff.env y
ExecStart=/usr/bin/java -Xms128m -Xmx512m -jar /opt/punto-gamer/bff.jar.
StateDirectory y MESSAGING_OUTPUT_DIR no son necesarios para el BFF.

```bash
sudo chmod 600 /etc/punto-gamer/backend.env /etc/punto-gamer/bff.env
sudo systemctl daemon-reload
sudo systemctl enable --now punto-gamer-backend
sudo systemctl enable --now punto-gamer-bff
sudo journalctl -u punto-gamer-backend --no-pager -n 80
sudo journalctl -u punto-gamer-bff --no-pager -n 80
curl -i http://127.0.0.1:8082/health
curl -i http://127.0.0.1:8084/health
curl -i http://127.0.0.1:8082/v2/productos/todos
```

Los dos /health deben devolver 200. No garantizan que Oracle/RabbitMQ funcionen:
comprobar tambien consultas reales, listeners y mensajes.
No limitar server.address a 127.0.0.1 en estos servicios: el ALB necesita alcanzarlos.

## 11. Configurar el ALB interno

Crear un ALB de tipo Internal en la VPC, con sg-alb y subnets en dos zonas.
Crear dos target groups de tipo instance:
- tg-backend: HTTP 8082; registrar la EC2 app.
- tg-bff: HTTP 8084; registrar la misma EC2 app.

Configurar health check /health, codigo esperado 200, en ambos target groups.
Crear listener HTTP 80, alcanzable solo desde sg-vpclink.

Reglas del listener, con prioridad explicita:
1. /api/bff/* y /bff/* -> tg-bff.
2. /v2/* y /api/* -> tg-backend.
3. Default -> respuesta fija 404.

La primera regla debe ir antes de /api/* para que el BFF no termine en el backend.
Esperar que ambos targets aparezcan healthy antes de conectar API Gateway.
Si alguno esta unhealthy, revisar servicio, puerto, ruta y sg-app.

## 12. Configurar API Gateway HTTP API

Crear una HTTP API, no WebSocket. Crear un VPC Link en la misma VPC,
con subnets adecuadas y sg-vpclink; esperar estado Available.

Crear integracion HTTP proxy privada:
- Connection type: VPC Link.
- Integration target: ARN del LISTENER del ALB, no la URL DNS ni el ARN del ALB.
- Conservar metodos y Authorization.
- Mapear overwrite:path a $request.path para no agregar el nombre del stage.

Crear rutas ANY /v2/{proxy+}, ANY /api/{proxy+} y ANY /bff/{proxy+}
apuntando a esa integracion. Para los paths implementados basta ese esquema.
Usar stage $default con auto-deploy para una URL base sin /dev.
Spring ya valida JWT: no necesitas desactivar su seguridad por estar detras de Gateway.

Configurar CORS en la HTTP API:
- Origins: URLs HTTPS exactas de React y Angular.
- Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS.
- Headers: Authorization, Content-Type.
- Expose headers: WWW-Authenticate.
- Allow credentials: false.

HTTP API se ocupa de preflight y usa su configuracion CORS en lugar de la
del backend. Mantener origins coherentes en Spring para solicitudes que
lleguen directamente por una ruta interna autorizada.

Un authorizer JWT de Gateway es una defensa adicional. Si lo agregas, aplicarlo
a rutas protegidas y no bloquear catalogo publico ni OPTIONS. Verificar audience
e issuer compatibles con Azure; no sustituye a los validadores Java.

Anotar la URL final, por ejemplo:
https://<API_ID>.execute-api.us-east-1.amazonaws.com

Comprobar primero por HTTP:
- GET /v2/productos/todos: 200 con datos del backend.
- GET /api/bff/me sin token: 401.
- Con access token correcto: 200.
- Consultar /api/bff/admin/queues/pedidos.queue con un usuario sin rol: 403.

No compartir tokens ni guardarlos en logs/capturas. Para pruebas autenticadas,
usar la sesion MSAL o un cliente HTTP que proteja las credenciales.

## 13. Publicar React

Crear un bucket S3 privado solo para el frontend. Mantener Block Public Access.
Crear una distribucion CloudFront usando el origen S3 normal, NO el website
endpoint. Configurar OAC con firma de solicitudes y la bucket policy limitada
a esa distribucion. Usar default root object index.html y redirigir HTTP a HTTPS.

Para rutas de la SPA, configurar respuestas 403/404 del origen S3 a /index.html,
codigo 200 y cache de error baja. En esta guia CloudFront sirve SOLO archivos,
no proxy de la API: no aplicar ese fallback a respuestas de autorizacion de API Gateway.

Configurar Frontend/.env.production.local antes del build:

```dotenv
VITE_API_URL=https://<API_ID>.execute-api.us-east-1.amazonaws.com
VITE_GATEWAY_URL=https://<API_ID>.execute-api.us-east-1.amazonaws.com
VITE_RABBIT_ADMIN_URL=https://<API_ID>.execute-api.us-east-1.amazonaws.com
VITE_AZURE_CLIENT_ID=<SPA_CLIENT_ID>
VITE_AZURE_TENANT_ID=<TENANT_ID>
VITE_AZURE_API_SCOPE=api://<API_CLIENT_ID>/Pedidos.Read
```

Todas las bases apuntan a Gateway. No poner la IP privada del backend en el navegador.
Si dejas las variables vacias como en desarrollo, el frontend intentara llamar a
CloudFront/S3: el proxy de Vite NO existe en produccion.

```powershell
cd C:\Users\rorro\Desktop\CloudNative\Frontend
npm ci
npm run build
aws s3 sync ./dist s3://<BUCKET_FRONT_REACT>/
aws cloudfront create-invalidation --distribution-id <DISTRIBUCION_REACT> --paths "/*"
```

No sincronizar la carpeta Frontend completa. Las variables VITE_* son publicas,
se incorporan al build y cambiar su archivo requiere volver a compilar.
Registrar el origin final de CloudFront en Azure y CORS de la API.

## 14. Publicar Angular, si lo necesitas

Usar otro bucket privado y otra distribucion CloudFront con la misma configuracion.
El codigo actual asume Angular en la raiz / de su dominio: no subirlo simplemente
a /angular dentro del sitio React sin cambiar base href, config y redirects.

Configurar FrontendAngular/public/config.json:

```json
{
  "tenantId": "<TENANT_ID>",
  "clientId": "<SPA_CLIENT_ID>",
  "apiScope": "api://<API_CLIENT_ID>/Pedidos.Read",
  "bffUrl": "https://<API_ID>.execute-api.us-east-1.amazonaws.com",
  "backendUrl": "https://<API_ID>.execute-api.us-east-1.amazonaws.com"
}
```

```powershell
cd C:\Users\rorro\Desktop\CloudNative\FrontendAngular
npm ci
npm test
npm run build
aws s3 sync ./dist/punto-gamer/browser s3://<BUCKET_FRONT_ANGULAR>/
aws cloudfront create-invalidation --distribution-id <DISTRIBUCION_ANGULAR> --paths "/*"
```

config.json contiene identificadores publicos, no secretos. Puede actualizarse
en el hosting sin reconstruir el codigo si cambian solo esos valores.
Evitar cache larga para config.json e index.html. Agregar el redirect URI de
este segundo dominio en Azure y su origin en CORS.

## 15. Comprobar RabbitMQ y guardar evidencias

El backend declara dos exchanges y seis colas:
- pedidos.exchange distribuye por routing key los eventos normales.
- pedidos.dlx recibe los mensajes rechazados o expirados.
- pedidos.queue, inventario.queue y notificaciones.queue reciben eventos.
- pedidos.dlq, inventario.dlq y notificaciones.dlq conservan errores.

Binding conecta un exchange con una cola. Routing key decide el destino.
ACK confirma procesamiento. NACK con requeue=false deriva a DLX/DLQ si la cola
esta configurada para ello. La TTL limita el tiempo de un mensaje en una cola.

Desde la EC2 RabbitMQ:

```bash
sudo docker compose -f /opt/punto-gamer/rabbitmq/compose.yml exec -T rabbitmq-1 rabbitmqctl list_queues -p levelup name type messages consumers
```

Verificar las seis colas y que las nuevas son quorum cuando la configuracion
del virtual host asi lo determina. No redeclarar una cola existente con otro
tipo/argumentos ni borrarla sin respaldar; eso produce PRECONDITION_FAILED
o perdida de mensajes.

Con una cuenta Rabbit.Admin, publicar un evento normal y uno con ERROR usando
los endpoints /api/pedidos/crear o de simulacion. Esperar el consumo y comprobar
ACK o la DLQ correspondiente; no usar una compra real como prueba destructiva.
Registrar cluster_status, mensajes, logs y respuestas 401/403 para la defensa.

## 16. Pendientes funcionales reales

Antes de presentar el sistema como completo, considerar:
- Los consumidores de notificaciones e inventario actuales simulan la operacion
  con logs y ACK. No hay envio SMTP real ni descuento de stock dentro del consumidor.
- El panel React pide /api/rabbitmq/topology y endpoints de exchanges/bindings que
  todavia no estan expuestos por el controlador actual. Esos botones pueden devolver
  404 aunque el despliegue este correcto. El CRUD de colas si esta expuesto.
- La generacion de boletas publica eventos desde mas de un punto. Hay que revisar
  duplicados, formato de mensajes y consistencia de transaccion antes de afirmar
  procesamiento exactamente una vez.
- No hay que interpretar los tests de JWT con H2/JWKS local como pruebas reales
  de Oracle, Azure, SMTP o tolerancia a fallos del cluster.
- La base Angular no reemplaza todas las pantallas de la tienda React.
- Terraform crea la VPC y una subred publica, pero no EC2 app, ALB, Gateway
  o S3/CloudFront. Para el ALB falta otra subred en una AZ diferente.

No hace falta solucionar estos puntos para comprobar que los procesos arrancan,
pero si deben resolverse o declararse para una entrega funcional completa.

## 17. Diagnostico rapido

| Sintoma | Revisar |
| --- | --- |
| InvalidClientTokenId / ExpiredToken | Sesion AWS, token temporal y perfil activo |
| Terraform AccessDenied en IAM | Para CreateRole, configurar un existing_instance_profile_name autorizado; PassRole y lectura SSM/KMS deben seguir permitidos |
| EC2 Unsupported en Availability Zone | Elegir availability_zone compatible y revisar el reemplazo de subred; consultar las ofertas del tipo EC2 |
| Docker no instalado y cloud-init muestra conflicto curl-minimal/curl | El script inicial fallo al instalar paquetes; usar el procedimiento de reparacion en infra/terraform/README.md sin recrear EC2 |
| EC2 no aparece en SSM | Agente, instance profile, DNS y salida 443 |
| RabbitMQ no inicia | SecureString, cookie/password, cloud-init y recursos de la EC2 |
| AMQP connection refused / timeout | IP privada, puerto, SG y estado de contenedores |
| PRECONDITION_FAILED | Tipo o argumentos de cola diferentes a los existentes |
| ORA-* o error de Hibernate | Wallet, permisos, alias TNS, red, tablas y migracion |
| ALB unhealthy | Puerto 8082/8084, proceso, /health y SG |
| API 404 | Path, stage y prioridad de reglas del ALB; endpoint implementado |
| API 401 | Access token para tu API, expiracion, issuer y audience |
| API 403 | Scope Pedidos.Read, rol Rabbit.Admin o propiedad del recurso |
| Perfil 409 | Vinculacion administrativa de usuario antiguo con tid:oid |
| CORS / Mixed content | HTTPS de API y origins/headers correctos |
| Azure redirect mismatch | URI exacta registrada como SPA |
| BFF 502/504 | BACKEND_URL, backend detenido o timeout |
| CloudFront funciona solo en / | Fallback SPA 403/404, default root y rutas |
| HTML en lugar de JSON | URL API vacia/incorrecta o fallback de SPA aplicado a APIs |

## 18. Cierre y costos

Respaldar BD y mensajes. Detener EC2 puede dejar costos de EBS y otros recursos.
El ALB/NAT tampoco se apagan por detener la EC2. Mantener un inventario de lo
creado por consola frente a lo administrado por Terraform.
No ejecutar terraform destroy sin revisar el plan y respaldar: destruye solo los
recursos del modulo, no elimina automaticamente toda esta arquitectura.

## Referencias oficiales

- [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- [Requisitos de Session Manager](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-prerequisites.html)
- [Corretto 21 en Amazon Linux](https://docs.aws.amazon.com/corretto/latest/corretto-21-ug/amazon-linux-install.html)
- [API Gateway: integracion privada](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-private.html)
- [API Gateway: CORS](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-cors.html)
- [CloudFront: S3 privado y OAC](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html)
- [CloudFront: rutas SPA](https://repost.aws/knowledge-center/cloudfront-single-page-application)
- [Registro de aplicaciones Entra](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app)
- [Oracle JDBC con wallet](https://docs.oracle.com/en/cloud/paas/autonomous-database/serverless/adbsb/connect-jdbc-thin-wallet.html)

