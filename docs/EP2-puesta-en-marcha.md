# EP2: levantar Punto Gamer y probarlo

Esta guía corresponde al frontend **Angular** y a los **seis servicios Java** de esta entrega. El script compila en Windows y ejecuta `docker compose ... up -d --build --wait` en la EC2. Las imágenes incluyen los JAR ya compilados; no necesitas Maven dentro de EC2.

## 1. Revisar Azure una vez

En el tenant `6fb3d735-1c10-4007-b977-7dbea3388386`:

1. En **PuntoGamer-API** (`ff0f75e1-6d35-40f4-89ae-44a2cfacd4b1`), Expose an API: scope `api://ff0f75e1-6d35-40f4-89ae-44a2cfacd4b1/Pedidos.Read`. Debe emitir access tokens versión 2 (`api.requestedAccessTokenVersion: 2`).
2. En **PuntoGamer-Frontend** (`30a37963-4067-4ac4-a8c4-fe7edcd2c289`), API permissions: permiso delegado `Pedidos.Read` de PuntoGamer-API y consentimiento cuando corresponda.
3. En Authentication del frontend, plataforma **Single-page application**: agregar el origen HTTPS que devuelva Terraform, con `/` al final. Para la URL actual: `https://7wnvd6bgue.execute-api.us-east-1.amazonaws.com/`. Si cambia, registrar el nuevo origen. Local opcional: `http://localhost:4200/`.
4. Para administrar RabbitMQ desde Angular/Postman: en **App registrations → PuntoGamer-API → App roles**, crear un rol habilitado de tipo **Users/Groups**, valor exacto **Rabbit.Admin**. Luego **Enterprise applications → PuntoGamer-API → Users and groups**, asignar ese rol a tu usuario. Cerrar sesión y volver a entrar para renovar el access token.

El rol se define en la API. El usuario `levelup` de RabbitMQ y su tag `administrator` son otra identidad. Si login funciona pero Administración devuelve 403, revisar la asignación de `Rabbit.Admin` en Azure. No necesitas un client secret para Angular. [Guía oficial de roles](https://learn.microsoft.com/en-us/entra/identity-platform/howto-add-app-roles-in-apps), [configuración SPA](https://learn.microsoft.com/en-us/entra/identity-platform/scenario-spa-app-configuration).

## 2. Reactivar el laboratorio y desplegar

En PowerShell del PC, con las credenciales temporales actuales de AWS Academy y Java 21, Node/npm, AWS CLI y Terraform disponibles:

```powershell
Set-Location 'C:\Users\rodrigo\Desktop\Cloud-nativ'
aws sts get-caller-identity
& '.\infra\deploy\Start-LabProject.ps1' -AllowApplicationReplacement
```

El script comprueba la cuenta y `LabInstanceProfile`, respalda el estado, compila y prueba todos los módulos, genera un plan y lo aplica. Puede reemplazar la **EC2 de aplicación** para instalar esta versión. Bloquea la creación de IAM y el borrado/reemplazo de RDS, RabbitMQ o red. Conserva `terraform.tfstate`, `terraform.tfvars`, los SecureString existentes y el perfil autorizado. Si bloquea un cambio, revisar el recurso indicado; no eliminar el estado ni usar `destroy`.

El paquete anterior de dos servicios no sirve para esta entrega: omitir `-SkipBuild` en el primer despliegue. `Build-Project.ps1` ahora crea un manifiesto versión 2 y el despliegue rechaza artefactos antiguos.

Espera hasta el resultado de las comprobaciones. **EC2 Running** y **Apply complete** solo acreditan infraestructura. El script final debe mostrar los seis `/health/...` con **HTTP 200**, catálogo **200**, y rutas protegidas **401** sin token. No abrir la IP de EC2: la entrada configurada es HTTPS por API Gateway.

Para consultar la URL vigente y repetir los checks sin redesplegar:

```powershell
terraform -chdir=infra/terraform output -raw website_url
& '.\infra\deploy\Verify-Project.ps1'
```

## 3. Revisar los contenedores en la EC2 de aplicación

En AWS EC2 selecciona la instancia con nombre **punto-gamer-dev-app**, Connect → Session Manager. También puedes obtener su comando actual desde PowerShell:

```powershell
terraform -chdir=infra/terraform output -raw application_session_command
```

Dentro de esa sesión Linux:

```bash
sudo systemctl status punto-gamer-application --no-pager -l
sudo docker compose -f /opt/punto-gamer/application/compose.yml ps -a
sudo journalctl -u punto-gamer-application --no-pager -n 100
sudo docker compose -f /opt/punto-gamer/application/compose.yml logs --tail=80 backend bff cart inventory notifications rabbit-admin proxy
curl -fsS http://127.0.0.1:8080/v2/productos/todos
```

Debe haber **backend, bff, cart, inventory, notifications, rabbit-admin y proxy** sanos. `activating` significa que el servicio de arranque sigue trabajando; `unhealthy`, reinicios o `status=1/FAILURE` requieren revisar el primer error del log. No borrar volúmenes ni regenerar contraseñas para diagnosticar.

Si aparece un error Flyway en V2, conservar la base y copiar el error SQL sin secretos. No ejecutar `flyway clean`. Si un JAR no puede leerse, revisar la nueva construcción y permisos: el paquete incluye `services/*/target/*.jar`, con lectura para el usuario de los contenedores.

## 4. Productos y compra real de demostración

Como ya poblaste la base, primero confirma que el catálogo muestra tus registros. Si necesitas datos adicionales, [demo-products.sql](sql/demo-products.sql) agrega tres productos ficticios faltantes sin sobrescribir existentes. Ejecutarlo en **MySQL**, no pegar comandos Bash en el prompt `mysql>`.

1. Abrir la URL HTTPS vigente e iniciar sesión.
2. Ir a **Catálogo**, pulsar **Agregar al carrito**.
3. Ir a **Carrito**, modificar cantidad y pulsar **Guardar cantidad**; recargar para comprobar persistencia.
4. Pulsar **Registrar compra** una vez. Debe aparecer el número de boleta y el total. Es una compra de demostración, sin cobro bancario.
5. En **Comprobantes**, actualizar tras unos segundos y descargar el HTML. Otro usuario no debe poder consultar ni descargar ese comprobante.
6. En **Administración**, consultar **Movimientos de inventario**. El stock se reserva al crear la compra; el consumidor registra el movimiento sin descontarlo una segunda vez.

Para ver productor y ACK, en la EC2 de aplicación:

```bash
sudo docker compose -f /opt/punto-gamer/application/compose.yml logs --since=10m backend cart inventory notifications rabbit-admin | grep -E 'PRODUCER|EVENT|SUCCESS|RETRY|NACK|ERROR'
```

Relaciona `eventId` entre **PRODUCER CONFIRMED** y **SUCCESS ... ACK enviado**. La línea **EVENT** incluye el número de boleta o referencia. Una compra produce tres eventos; agregar/modificar/quitar del carrito también produce un evento de pedidos. Un evento permanece en `messaging_outbox` mientras no se confirme su publicación; no se pierde por una caída temporal del broker.

## 5. Probar RabbitMQ desde el frontend

Con el rol **Rabbit.Admin**, abre **Administración**:

1. **Actualizar topología**: tres colas principales y tres DLQ en `levelup`.
2. Dominio **Pedidos → Enviar normal**. Guardar el `eventId` de la respuesta y buscar su **SUCCESS / ACK** en los logs.
3. **Enviar error a DLQ**. Buscar **ERROR / NACK requeue=false destinoDLQ=...** en el mismo servicio; actualizar topología y comprobar que `pedidos.dlq` aumentó respecto del contador inicial. Si ya tenía un mensaje, el resultado esperado es 2, no necesariamente 1.
4. **Probar reintentos**: el fallo temporal controlado debe emitir RETRY y terminar en ACK tras tres reintentos. Un fallo temporal persistente acaba en DLQ al agotar el límite.

Las colas principales pueden mostrar 0 porque el consumidor procesa rápido. `routed:true` demuestra enrutamiento; no demuestra que el consumidor terminó correctamente. Una DLQ con mensajes demuestra rechazo/envejecimiento; para acreditar NACK, conservar el log del consumidor del mismo evento. Las DLQ tienen TTL de 24 horas; capturar la evidencia después de probar.

## 6. Dashboard RabbitMQ y alternativa por consola

Para ver el dashboard, mantener este túnel abierto en una segunda PowerShell del PC:

```powershell
Set-Location 'C:\Users\rodrigo\Desktop\Cloud-nativ'
$rabbitInstance = terraform -chdir=infra/terraform output -raw instance_id
$tunnelParameters = Join-Path $env:TEMP 'punto-gamer-rabbit-tunnel.json'
@{ portNumber=@('15672'); localPortNumber=@('15672') } | ConvertTo-Json | Set-Content -LiteralPath $tunnelParameters -Encoding ascii
aws ssm start-session --region us-east-1 --target $rabbitInstance --document-name AWS-StartPortForwardingSession --parameters "file://$tunnelParameters"
```

Requiere el plugin Session Manager instalado en el PC. Abrir `http://localhost:15672`, usuario `levelup` y la contraseña existente de `/punto-gamer/dev/rabbitmq/password`, no la de MySQL. Elegir vhost `levelup`. No incluir contraseñas ni JWT en capturas.

Dentro de Session Manager de **punto-gamer-dev-rabbitmq**:

```bash
sudo docker compose -f /opt/punto-gamer/rabbitmq/compose.yml ps
sudo docker compose -f /opt/punto-gamer/rabbitmq/compose.yml exec -T rabbitmq-1 rabbitmqctl cluster_status
sudo docker compose -f /opt/punto-gamer/rabbitmq/compose.yml exec -T rabbitmq-1 rabbitmqctl list_queues -p levelup name messages_ready messages_unacknowledged consumers
```

Los tres nodos deben estar en `running_nodes`. Un contenedor healthy por sí solo no acredita pertenencia al cluster. No se purgan colas para sacar capturas.

Para publicar una prueba desde esa terminal sin escribir la contraseña a mano, copiar **todo** este bloque Bash:

```bash
sudo bash <<'BASH'
set -eu
source /opt/punto-gamer/rabbitmq/.env
curl --fail --show-error --user "levelup:$RABBITMQ_PASSWORD" \
  -H 'Content-Type: application/json' \
  -X POST http://127.0.0.1:15672/api/exchanges/levelup/pedidos.exchange/publish \
  --data '{"properties":{"delivery_mode":2,"content_type":"application/json","message_id":"EP2-consola-01"},"routing_key":"pedido.creado","payload":"{\"idPedido\":\"EP2-consola-01\",\"mensaje\":\"Prueba normal\"}","payload_encoding":"string"}'
BASH
```

Para una nueva prueba cambiar `message_id` y `idPedido` (la deduplicación evita efectos repetidos). Para probar DLQ cambiar `mensaje` a `ERROR: prueba controlada` y usar otro ID. Si devuelve 401, confirmar que estás en la EC2 RabbitMQ y que tomas **su** `.env`; no cambiar la contraseña del volumen por ensayo y error. Preferir las pruebas de Angular para evitar problemas de copiado.

## 7. API Admin en Postman

Importar [EP2-PuntoGamer.postman_collection.json](postman/EP2-PuntoGamer.postman_collection.json). Variables locales: `baseUrl` = HTTPS vigente, `accessToken` = access token de la API con `Rabbit.Admin` (no ID token). En el navegador puedes obtenerlo localmente desde Network → petición autenticada → Authorization, sin compartirlo ni guardarlo en Git.

Ejecutar en orden: topología; crear cola; nombre vacío **400**; crear exchange; crear binding; eliminar binding; eliminar cola; eliminar exchange. La colección verifica los códigos esperados. Los recursos `evidencia.ep2` y `evidencia.exchange` son de prueba: las seis colas y dos exchanges de negocio están protegidos contra eliminación. Sin JWT debe devolver 401 y con usuario sin rol administrador, 403.

## 8. Entrega en AVA

Capturar después de desplegar:

- Angular con sesión iniciada, productos, carrito, número de compra y comprobante.
- Docker Compose mostrando seis servicios Java y proxy saludables.
- Dashboard con tres nodos, exchanges, tres colas y tres DLQ del vhost `levelup`.
- Productor confirmado y ACK del consumidor correlacionados por eventId.
- Error capturado, NACK sin requeue y aumento de la DLQ del mismo dominio.
- Postman con creación 201, validación 400 y eliminaciones 204.

Guardar los enlaces GitHub del frontend Angular y del backend/servicios; revisar `git status` y publicar los archivos fuente antes de copiar enlaces para AVA. `node_modules`, `.angular`, `target`, `.idea`, `.env`, secretos y estado Terraform se ignoran. Las capturas anteriores acreditan el broker anterior; las funciones nuevas requieren estas pruebas tras el despliegue. La matriz documenta dónde revisar cada criterio, sin prometer una nota.
