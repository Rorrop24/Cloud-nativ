# Punto Gamer: despliegue completo

## Tres comandos

Desde PowerShell, en C:\Users\rorro\Desktop\CloudNative, con AWS CLI autenticado,
Node 22.12+ y JDK 17+ (se verifica con JDK 21):

```powershell
.\infra\deploy\Deploy-Project.ps1 -Mode Plan
terraform -chdir=infra/terraform show project.tfplan
# Aplicar solo tras revisar el plan y los creditos del laboratorio:
.\infra\deploy\Deploy-Project.ps1 -Mode Apply
```

Plan compila Backend/BFF, ejecuta sus pruebas, construye React y empaqueta los
archivos necesarios. No necesita Docker en Windows. Crea los SecureString
iniciales que falten, sin sobrescribir secretos ni regenerarlos si la BD/broker
ya existen. Apply crea la infraestructura y publica el ZIP privado en S3.
Docker y Compose se instalan en las EC2; las imagenes Java se construyen alli.
El bootstrap tambien instala Buildx con SHA256 verificado y ajusta permisos
solo de los archivos publicos de React para que Nginx pueda servirlos.
Puedes usar `-SkipBuild` en Plan si el paquete ya fue construido y no cambio.

RDS ya existe: el plan debe conservarla y no cambiar su password. No ejecutar
`terraform destroy` para desplegar o reintentar. Un apply parcial conserva su
estado: resolver el error y volver a Plan. No reutilizar planes antiguos.

## Arquitectura de Learner Lab

```text
Navegador -- HTTPS --> API Gateway HTTP API
                            |
                         VPC Link
                            |
                         ALB interno
                            |
                         EC2 aplicacion :8080 (solo desde ALB)
                            +-- Nginx: React + rutas SPA
                            +-- Backend Java :8082 (red Docker)
                            +-- BFF Java :8084 (red Docker)
                                 |
                                 +-- RDS MySQL privado, TLS
                                 +-- EC2 RabbitMQ: tres nodos, quorum y DLQ

Login Microsoft --> Azure Entra ID
```

La URL HTTPS que entrega `website_url` publica pagina y API bajo el mismo origen.
El ALB escucha HTTP solo dentro de la VPC; no se presenta como TLS extremo a
extremo. RDS si exige TLS con certificado/hostname verificados.
No se abren SSH, 8082, 8084, 3306 ni AMQP al Internet. La EC2 tiene IP publica
para descargar paquetes, imagenes y contactar Azure/SSM, con entrada 8080 solo
desde el ALB. El dashboard RabbitMQ sigue en loopback, mediante tunel SSM.

Se crea una segunda subred para ALB/VPC Link, distinta de las subredes de RDS.
Ambas EC2 usan `LabInstanceProfile` cuando esta configurado; no se crean roles
IAM en ese modo. El perfil debe permitir SSM, leer/descifrar los secretos y
leer el ZIP privado de S3. Tener el perfil no garantiza esos permisos.

Son dos EC2 t3.medium, discos cifrados, un ALB, API Gateway y S3, ademas de RDS.
Generan costos/consumen creditos mientras existan. No hay NAT, EKS ni GitHub Actions.
La aplicacion, RabbitMQ y RDS Single-AZ no tienen alta disponibilidad completa.
Los tres nodos RabbitMQ comparten una sola EC2.

## Paso obligatorio en Azure

Terraform AWS no modifica Azure. Despues de Apply:

1. Consultar `terraform -chdir=infra/terraform output -raw website_url`.
2. En Azure Entra ID -> App registrations -> SPA Punto Gamer -> Authentication,
   agregar esa URL HTTPS como Redirect URI de tipo **Single-page application**.
3. Mantener el scope `Pedidos.Read` y el app role `Rabbit.Admin` de la API.
   Asignar el rol al usuario que realizara administracion/pruebas DLQ.
4. Ingresar al sitio, iniciar sesion con Microsoft y probar las operaciones.

Los IDs publicos de tenant, SPA y audiencia se configuran con `azure_tenant_id`,
`azure_frontend_client_id` y `azure_api_audience`. Nunca se usa un client secret
en React. La URL nueva debe registrarse antes del primer login; un error
AADSTS50011 significa que la Redirect URI no coincide.

## Comprobar el arranque

Apply confirma creacion de recursos, no que cloud-init/Compose terminaron.
El bootstrap descarga/verifica el ZIP, lee secretos y espera conectividad a
RabbitMQ antes de arrancar. Puede tardar varios minutos. Entra por el comando
`application_session_command` y revisa:

```bash
sudo systemctl status punto-gamer-application --no-pager
sudo journalctl -u punto-gamer-application --no-pager -n 80
sudo tail -n 80 /var/log/cloud-init-output.log
sudo docker compose -f /opt/punto-gamer/application/compose.yml ps
curl --fail http://127.0.0.1:8080/v2/productos/todos
```

En la EC2 RabbitMQ:

```bash
sudo systemctl status punto-gamer-rabbitmq --no-pager
sudo docker compose -f /opt/punto-gamer/rabbitmq/compose.yml exec -T rabbitmq-1 rabbitmqctl cluster_status
sudo docker compose -f /opt/punto-gamer/rabbitmq/compose.yml exec -T rabbitmq-1 rabbitmqctl list_queues -p levelup name type messages consumers
```

Cuando el ALB tenga su target healthy, desde el PC:

```powershell
.\infra\deploy\Verify-Project.ps1
```

Verifica pagina/rutas SPA, health, catalogo y 401 sin JWT en rutas protegidas.
Para la defensa agrega una prueba autenticada: crear producto, reiniciar backend,
consultarlo otra vez y enviar un pedido/evento que se consuma o termine en DLQ.
Flyway crea las tablas automaticamente; la BD empieza vacia, sin importar Oracle.
Los logs/eventos de la aplicacion viven en el disco de esa EC2, no en RDS.

## Cambios y seguridad

Los archivos locales `infra/.deploy`, planes, estado, metadatos y tfvars no se
versionan. El ZIP incluye solo JAR, Dockerfiles, React compilado, Compose,
Nginx y el configurador; excluye wallets, .env, credenciales AWS y codigo de tests.
Los secrets se escriben en archivos root/600 en EC2; BFF no recibe password de BD.
Terraform recibe la password RDS como variable efimera/write-only.

Una nueva version del ZIP cambia user_data y reemplaza la EC2 de aplicacion.
Se crea primero la nueva EC2 antes de eliminar la anterior; una falta de permisos
para RunInstances no elimina por adelantado una maquina que funciona. Puede haber
una EC2 adicional brevemente durante la actualizacion. Esto no es un despliegue
blue/green con espera de health: aun se debe verificar el arranque nuevo.
Para ello revisa el plan, respalda logs/eventos y usa Apply con
`-AllowApplicationReplacement`. Esa opcion no autoriza reemplazar RabbitMQ/RDS/red.
La eliminacion de objetos S3 de una release antigua si se permite. Los buckets
no usan force_destroy. Respaldar/purgar releases se hace de forma explicita.

En Learner Lab, el proveedor AWS consulta Object Lock al leer `aws_s3_bucket`,
y una politica del laboratorio lo prohibe. El wrapper crea/reutiliza un bucket
con operaciones S3 permitidas y pasa `application_release_bucket_name` a Terraform.
Terraform sigue gestionando bloqueo de acceso publico, cifrado, politica TLS y
el ZIP, pero no la creacion/eliminacion de ese bucket. Nunca intenta modificar la
politica del laboratorio. El bucket se conserva tambien tras eliminar la pila;
su limpieza requiere una accion manual explicita. Fuera de ese modo, Terraform
puede gestionar el bucket completo dejando esa variable en null.

## CloudFront opcional

`enable_cdn = false` es el default para Learner Lab. La cuenta de esta entrega
rechazo ListCachePolicies/ListOriginRequestPolicies; no se modificaron permisos.
Con `enable_cdn = true`, y una cuenta autorizada para administrar CloudFront,
React se publica en S3 privado con OAC y la misma distribucion reenvia las API
a API Gateway, sin cache y conservando Authorization. No se usan errores 401/403
como fallback SPA. El modo CDN tiene pruebas locales con AWS simulado;
no se considera desplegado hasta verificarlo en una cuenta con permisos.

## Validacion y limites

### Estado de esta ejecucion

AWS creo la infraestructura, S3 privado y cifrado, API Gateway/ALB y la EC2
RabbitMQ. Se verificaron sus tres nodos corriendo, sin alarmas ni particiones.
RDS siguio `available`, privada, cifrada y con parametros `in-sync`.
La primera EC2 de aplicacion fallo antes de construir imagenes porque faltaba
Buildx; tambien se detectaron permisos 600 en el frontend. Ambas correcciones
estan incorporadas al bootstrap, no dependen de una instalacion manual.

Durante el reemplazo de esa EC2 fallida, Learner Lab revoco la sesion mediante
`voc-cancel-cred`. La nueva EC2 quedo pendiente y la web no se considera operativa.
No se completo la comprobacion real de JDBC/Flyway ni las respuestas HTTP finales.
Reactivar Start Lab, renovar las credenciales locales incluido el session token,
y volver a Plan con `-SkipBuild`, revisar y Apply. No usar el plan anterior ni
destroy. La URL prevista es `https://3bokishrod.execute-api.us-east-1.amazonaws.com`.

Los tests Terraform usan AWS simulado; las pruebas de secretos usan valores
ficticios. Maven verifica los dos servicios; dos pruebas MySQL con Testcontainers
se omiten si Docker local no esta disponible. La conexion JDBC real se verifica
al arrancar la EC2 y consultar el catalogo, no con los mocks.
Los tests antiguos LoginForm/RegistroForm aun fallan: prueban el login AES/localStorage
anterior y etiquetas/test IDs que esos componentes ya no tienen. El acceso real
del sitio usa MSAL en la pagina Auth, con pruebas enfocadas del flujo y apiFetch.
La base Angular permanece separada para referencia; el sitio desplegado es React,
segun la opcion aprobada para este proyecto.

## Referencias

- [API Gateway con integraciones privadas](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-private.html)
- [Docker en Amazon Linux 2023](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/create-container-image.html)
- [Politicas de cache CloudFront](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-managed-cache-policies.html)
- [Politica de origen para API Gateway](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-managed-origin-request-policies.html)
