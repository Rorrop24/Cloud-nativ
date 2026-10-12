# Terraform - Punto Gamer

Esta configuracion prepara una EC2 nueva dedicada a RabbitMQ en una subnet
existente. No modifica las instancias actuales ni despliega el frontend o el backend.

## Que incluye

- Amazon Linux 2023 x86_64, `t3.medium` por defecto y disco gp3 cifrado de 40 GiB.
- Docker y Compose, con versiones fijas y verificacion SHA256 del ejecutable Compose.
- Tres nodos RabbitMQ 4.3.6 con volumenes independientes, healthchecks y reinicio.
- Virtual host `levelup` y colas quorum por defecto para nuevas declaraciones.
- AMQP en 5672, 5673 y 5674, accesible solo desde los security groups indicados.
- Dashboard enlazado a `127.0.0.1`, disponible mediante tunel de Systems Manager.
- Rol IAM para SSM y lectura de los dos SecureString necesarios en Parameter Store.
- Servicio systemd que inicia el cluster y comprueba sus tres nodos al arrancar.

Los tres contenedores comparten una EC2: pueden tolerar la perdida de un nodo
RabbitMQ con colas quorum, pero no la caida de la instancia completa.

## Validacion local

Terraform 1.10 o superior. Estos comandos descargan el proveedor y validan con
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

## Conectar despues a AWS

1. Configurar AWS CLI v2 con una sesion valida para la cuenta del proyecto.
2. Completar `terraform.tfvars` usando como referencia `terraform.tfvars.example`:
   cuenta, region, subnet y security groups existentes del backend.
3. La subnet y los grupos del backend deben pertenecer a la misma VPC. Usar
   una subnet publica con ruta a Internet si `associate_public_ip_address = true`;
   si se cambia a `false`, asegurar salida a Internet por NAT y conectividad SSM.
4. Crear en Parameter Store dos parametros de tipo **SecureString**:
   `/punto-gamer/dev/rabbitmq/password` y `/punto-gamer/dev/rabbitmq/erlang-cookie`.
   Cada valor debe tener entre 32 y 128 caracteres: letras, numeros, `_` o `-`.
   Usar valores diferentes y aleatorios. Terraform solo recibe sus nombres.
5. Si se usa una clave KMS propia, configurar `secrets_kms_key_arn` y permitir
   que el rol de la EC2 utilice la clave desde SSM.
6. Revisar el plan antes de aplicar:

```powershell
aws sts get-caller-identity
terraform plan -out=deployment.tfplan
terraform show deployment.tfplan
terraform apply deployment.tfplan
```

`aws_account_id` limita el proveedor a la cuenta elegida. Los valores del ejemplo
son ficticios y deben reemplazarse. No se ha ejecutado `apply` durante la implementacion.
La EC2, EBS y una IP publica generan costos mientras existan; no se asume que son gratuitos.
Cambiar la AMI o `user_data` puede reemplazar la instancia: revisar siempre el plan
y respaldar los mensajes antes de un reemplazo o `terraform destroy`.

## Conectar el backend

Consultar `terraform output backend_environment` y configurar en Spring Boot:

```text
RABBITMQ_ADDRESSES=<ip-privada>:5672,<ip-privada>:5673,<ip-privada>:5674
RABBITMQ_USERNAME=levelup
RABBITMQ_VHOST=levelup
RABBITMQ_PASSWORD=<valor del SecureString password>
```

La direccion privada funciona desde el backend en la VPC, no directamente desde
tu computador. El security group del backend debe autorizar salida a esos puertos.
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
ni una VPC adicional en esta implementacion.

## Referencias

- [EC2 en el proveedor AWS](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/instance)
- [Systems Manager Agent](https://docs.aws.amazon.com/systems-manager/latest/userguide/ssm-agent.html)
- [Formacion de clusters RabbitMQ](https://www.rabbitmq.com/docs/cluster-formation)
- [Virtual hosts y tipo de cola](https://www.rabbitmq.com/docs/vhosts)
- [Backend S3 de Terraform](https://developer.hashicorp.com/terraform/language/backend/s3)
