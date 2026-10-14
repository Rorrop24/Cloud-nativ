# Terraform - Punto Gamer

Esta configuracion crea una red nueva, una EC2 dedicada a RabbitMQ y,
con `enable_database = true`, una base RDS MySQL privada sin wallet.
Para incorporar RDS al despliegue existente sigue [la guia MySQL](../../docs/aws-mysql.md)
y `infra/deploy/Deploy-Database.ps1`; no ejecutes un apply completo sin revisar
el posible reemplazo de la EC2 por el cambio previo de user_data.
Con `enable_application = true` despliega Angular y los seis servicios Java en Docker,
API Gateway y ALB interno. Usar [la guia completa](../../docs/EP2-puesta-en-marcha.md)
y `infra/deploy/Deploy-Project.ps1`, que compila y carga la password efimera de RDS.
CloudFront es opcional; Learner Lab usa HTTPS de API Gateway por defecto.
Mover una EC2 a otra subred o cambiar user_data requiere reemplazo: revisar el plan.

## Que incluye

- VPC `10.0.0.0/16`, Internet Gateway, subred publica `10.0.1.0/24`,
  tabla con ruta `0.0.0.0/0` al IGW y asociacion de la tabla a la subred.
- DNS habilitado y asignacion automatica de IP publica en la subred.
- Zona de disponibilidad seleccionada entre las habilitadas que ofrecen el
  tipo de EC2; se puede fijar con `availability_zone`.
- Grupos nuevos de RabbitMQ y backend en la misma VPC. El del backend no
  permite entrada por defecto y permite salida a Oracle, Azure, SSM y RabbitMQ.
- Amazon Linux 2023 x86_64, `t3.medium` por defecto y disco gp3 cifrado de 40 GiB.
- Docker y Compose, con versiones fijas y verificacion SHA256 del ejecutable Compose.
- Tres nodos RabbitMQ 4.3.6 con volumenes independientes, healthchecks y reinicio.
- Virtual host `levelup` y colas quorum por defecto para nuevas declaraciones.
- AMQP en 5672, 5673 y 5674, accesible solo desde el grupo del backend creado.
- Dashboard enlazado a `127.0.0.1`, disponible mediante tunel de Systems Manager.
- Rol IAM propio para SSM/secretos, o reutilizacion de un instance profile
  autorizado en AWS Academy sin crear ni modificar recursos IAM.
- Servicio systemd que inicia el cluster y comprueba sus tres nodos al arrancar.
- RDS MySQL opcional: dos subredes privadas, acceso 3306 solo desde el backend,
  cifrado, TLS obligatorio, backups y proteccion de borrado.

Los tres contenedores comparten una EC2: pueden tolerar la perdida de un nodo
RabbitMQ con colas quorum, pero no la caida de la instancia completa.

## Validacion local

Terraform 1.11 o superior. Estos comandos descargan el proveedor y validan con
AWS simulado; no necesitan credenciales ni crean recursos:

```powershell
cd C:\Users\rorro\Desktop\CloudNative\infra\terraform
terraform init -backend=false
terraform fmt -check -recursive
terraform validate
terraform test
```

El archivo `.terraform.lock.hcl` se versiona para fijar el proveedor. El estado,
los planes y los archivos `.tfvars` locales se excluyen con `.gitignore`.
Las pruebas no acceden a AWS; usan credenciales ficticias. Con RDS activado, un
plan real requiere cargar la password efimera mediante el script de despliegue.
Los comandos generales de las siguientes secciones son para los modulos opcionales
deshabilitados. Tras incorporar RDS/aplicacion, usar el script completo, no desactivar
modulos para evitar prompts: hacerlo puede proponer eliminar recursos.

## Conectar despues a AWS

1. Configurar AWS CLI v2 con una sesion valida para la cuenta del proyecto.
2. Completar `terraform.tfvars` usando como referencia `terraform.tfvars.example`:
   cuenta y region. Ya no se necesitan IDs de subred ni de security groups existentes.
   Eliminar `subnet_id` y `backend_security_group_ids` de configuraciones locales antiguas.
3. Mantener `associate_public_ip_address = true` para que el arranque tenga salida
   a Internet por el IGW. Este modulo no crea NAT ni endpoints privados.
4. Crear en Parameter Store dos parametros de tipo **SecureString**:
   `/punto-gamer/dev/rabbitmq/password` y `/punto-gamer/dev/rabbitmq/erlang-cookie`.
   Cada valor debe tener entre 32 y 128 caracteres: letras, numeros, `_` o `-`.
   Usar valores diferentes y aleatorios. Terraform solo recibe sus nombres.
5. Si se usa una clave KMS propia, configurar `secrets_kms_key_arn` y permitir
   que el rol de la EC2 utilice la clave desde SSM.
6. Terraform consulta zonas habilitadas y ofertas del tipo de instancia. El
   usuario necesita `ec2:DescribeAvailabilityZones` y `ec2:DescribeInstanceTypeOfferings`.
   Con `availability_zone = null`, elige la primera zona compatible ordenada;
   fijar despues el output `availability_zone` evita cambios futuros de subred.
   Una zona explicita tambien se verifica antes de crear recursos.
7. Revisar el plan antes de aplicar:

```powershell
aws sts get-caller-identity
terraform plan -out=network.tfplan
terraform show network.tfplan
terraform apply network.tfplan
```

No aplicar el `deployment.tfplan` anterior: los planes guardados conservan la
configuracion con la que se generaron. Crear siempre un plan nuevo para esta red.
`aws_account_id` limita el proveedor a la cuenta elegida. Los valores del ejemplo
son ficticios y deben reemplazarse. Las pruebas locales usan AWS simulado;
el usuario revisa y aplica por separado los planes reales.
La EC2, EBS y una IP publica generan costos mientras existan; no se asume que son gratuitos.
Cambiar la subred, la AMI o `user_data` puede reemplazar la instancia: revisar siempre el plan
y respaldar los mensajes antes de un reemplazo o `terraform destroy`.

## Tipo de instancia no soportado en una zona

La EC2 hereda la zona de su subred; no basta con cambiar la zona en aws_instance.
Si AWS rechaza t3.medium en us-east-1e, elegir una zona ofrecida para la cuenta.
En este despliegue AWS sugirio us-east-1a y se fijo en el tfvars local:

```hcl
availability_zone = "us-east-1a"
```

`network.tf` verifica esa zona contra las zonas habilitadas y las ofertas de
`instance_type`. Esta consulta verifica soporte, no reserva capacidad ni garantiza
que haya capacidad libre al lanzar. No reducir a t3.micro: tres nodos requieren RAM.
Cambiar la zona reemplaza la subred y su asociacion de rutas; no es una migracion
de instancias o datos. Si hay EC2, ALB u otros recursos usando esa subred, no
aprobar el reemplazo sin un procedimiento de migracion y respaldo.

```powershell
terraform validate
terraform plan -out=zone.tfplan
terraform show zone.tfplan
# Revisar reemplazos y que la subred antigua no tenga recursos en uso:
terraform apply zone.tfplan
```

No reutilizar lab.tfplan u otros planes guardados. No ejecutar destroy para reintentar.

## Conflicto curl / curl-minimal al arrancar

Amazon Linux 2023 incluye curl-minimal. El bootstrap usa ese paquete para no
entrar en conflicto con curl completo. Si una EC2 creada con el script anterior
fallo en la primera instalacion y no tiene Docker ni el servicio RabbitMQ,
reparar desde Session Manager, sin recrear la instancia:

```bash
sudo cp -p /var/lib/cloud/instance/scripts/part-001 /var/tmp/punto-gamer-cloud-init.before-curl-fix
sudo sed -i 's/python3 curl$/python3 curl-minimal/' /var/lib/cloud/instance/scripts/part-001
sudo bash /var/lib/cloud/instance/scripts/part-001
```

Este procedimiento reejecuta el script de arranque inicial corregido, instala
Docker/Compose y crea el servicio. Usarlo solo para este fallo inicial, antes
de que exista un broker con datos. Esperar a que termine; no ejecutar en paralelo
si cloud-init sigue corriendo. No usar --allowerasing, --skip-broken ni cloud-init clean.
Si falta un SecureString o su permiso SSM/KMS, el servicio seguira fallando:
consultar `sudo journalctl -u punto-gamer-rabbitmq --no-pager -n 60`.
`cloud-init status` puede conservar el error del primer arranque; comprobar ahora
el servicio systemd, los contenedores y el cluster, no solo ese estado historico.

La correccion del template cambia user_data. Como user_data_replace_on_change
es true, un futuro terraform apply propondra reemplazar esta EC2. No aplicarlo
sin revisar el plan y respaldar los datos. Esta reparacion manual no actualiza
el atributo user data de EC2 ni modifica el estado Terraform.

## AWS Academy / Learner Lab

Si el laboratorio rechaza `iam:CreateRole`, usar el nombre de un instance
profile existente y autorizado. En este laboratorio se encontro `LabInstanceProfile`:

```hcl
existing_instance_profile_name = "LabInstanceProfile"
```

Con ese valor, los recursos de rol, perfil, politica y attachment tienen `count = 0`.
La EC2 utiliza el perfil existente; Terraform no lo importa, modifica ni administra
sus permisos. No usar el perfil de EMR para este servicio.
El perfil debe confiar en EC2, permitir SSM y la lectura/descifrado de los dos
SecureString. El usuario debe tener `iam:PassRole` para su rol. La existencia del
perfil no demuestra por si sola estos permisos; verificar errores de SSM/cloud-init.
Con una clave KMS propia, el rol existente necesita tambien el descifrado autorizado.

Tras corregir el error, conservar `terraform.tfstate` y generar un plan nuevo:

```powershell
terraform validate
terraform plan -out=lab.tfplan
terraform show lab.tfplan
# Aplicar solo despues de revisar cambios y costos:
terraform apply lab.tfplan
```

No reutilizar `network.tfplan` ni planes anteriores. La red creada en el apply
parcial permanece administrada por el mismo estado. No ejecutar destroy para reintentar.
Si ya existian recursos IAM propios administrados, cambiar de modo puede proponer
eliminarlos: revisar el plan antes de aprobar. Los bloques moved conservan sus
direcciones al agregar count en modo propio. Omitir el input o usar null mantiene
el modo propio y su politica limitada a los dos parametros; esos limites no se
pueden imponer sobre el perfil del laboratorio desde este modulo.

## HCL de la red y referencia de la EC2

Los cinco recursos de red estan en `network.tf`; Terraform carga todos los `.tf`
del directorio sin necesidad de importarlos. En `main.tf`, la EC2 ahora usa:

```hcl
subnet_id = aws_subnet.public.id
```

El grupo de RabbitMQ usa `vpc_id = aws_vpc.main.id`, no una VPC externa.
La instancia espera la asociacion de rutas y las reglas de salida antes de arrancar.
Esta red contiene una sola subred publica; un ALB regional necesitara una segunda
subred apropiada en otra AZ. Las subredes privadas de RDS no deben usarse para el ALB.

## Conectar el backend

Crear la EC2 de aplicacion en `terraform output -raw public_subnet_id` y asociar
el grupo de `terraform output -raw backend_security_group_id`. No se pueden
asociar grupos de otra VPC. Si el backend sigue en la VPC anterior, no habra
conectividad privada automatica; desplegarlo en la nueva o disenar una interconexion.
Para publicar las API, agregar al grupo del backend entrada 8082/8084 solo desde
el grupo del ALB. No abrir estos puertos ni RabbitMQ a todo Internet.

Consultar `terraform output backend_environment` y configurar en Spring Boot:

```text
RABBITMQ_ADDRESSES=<ip-privada>:5672,<ip-privada>:5673,<ip-privada>:5674
RABBITMQ_USERNAME=levelup
RABBITMQ_VHOST=levelup
RABBITMQ_PASSWORD=<valor del SecureString password>
```

La direccion privada funciona desde el backend en la VPC, no directamente desde
tu computador. El grupo del backend creado permite salida, pero no crea el backend.
Nunca poner la password ni claves AWS en `.tf`, `user_data` o archivos versionados.
La configuracion existente en `Backend/rabbitmq` queda intacta; este despliegue
utiliza las plantillas de `infra/terraform/templates`.

## Dashboard y evidencias

Instalar AWS Session Manager Plugin en el computador y ejecutar el comando que
entrega `terraform output -raw management_tunnel_command`. Mientras el tunel
este abierto, ingresar a `http://localhost:15672` con el usuario configurado.

Para obtener una consola de la EC2:

```powershell
aws ssm start-session --region us-east-1 --target <instance_id>
```

Dentro de la instancia:

```bash
sudo systemctl status punto-gamer-rabbitmq
sudo journalctl -u punto-gamer-rabbitmq --no-pager -n 80
sudo tail -n 80 /var/log/cloud-init-output.log
sudo docker compose -f /opt/punto-gamer/rabbitmq/compose.yml ps
sudo docker compose -f /opt/punto-gamer/rabbitmq/compose.yml exec -T rabbitmq-1 rabbitmqctl cluster_status
sudo docker compose -f /opt/punto-gamer/rabbitmq/compose.yml exec -T rabbitmq-1 rabbitmqctl list_queues -p levelup name type messages consumers
```

El login de Systems Manager no reemplaza los permisos IAM del usuario que abre
la sesion. Si faltan parametros SSM, el servicio reintenta cada 30 segundos;
el error se ve en `journalctl`. Cambiar los parametros no rota usuarios o cookies
en un broker ya inicializado: esa operacion necesita su propio procedimiento.

Para la defensa, mostrar el plan, los tres nodos y un mensaje real consumido o
enviado a DLQ por el backend. Las pruebas Terraform con mocks verifican la
configuracion; no demuestran por si solas un cluster funcionando en AWS.

## Estado remoto opcional

Para trabajo en pareja, se puede configurar despues un backend S3 en un bucket
existente, con cifrado, versionado y `use_lockfile = true`. No se crea un bucket
de estado en esta implementacion.

## Referencias

- [curl-minimal en AL2023](https://docs.aws.amazon.com/linux/al2023/ug/curl-minimal.html)
- [Ofertas de tipos EC2 por zona](https://docs.aws.amazon.com/cli/latest/reference/ec2/describe-instance-type-offerings.html)
- [Subred publica e Internet Gateway](https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Internet_Gateway.html)
- [EC2 en el proveedor AWS](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/instance)
- [Systems Manager Agent](https://docs.aws.amazon.com/systems-manager/latest/userguide/ssm-agent.html)
- [Formacion de clusters RabbitMQ](https://www.rabbitmq.com/docs/cluster-formation)
- [Virtual hosts y tipo de cola](https://www.rabbitmq.com/docs/vhosts)
- [Backend S3 de Terraform](https://developer.hashicorp.com/terraform/language/backend/s3)
