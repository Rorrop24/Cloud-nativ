# Cambios de infraestructura y seguridad

## RabbitMQ

Usar el virtual host nuevo `levelup` y tres nodos Docker Compose.
Declarar las seis colas descritas en EP2-plan.md como quorum.
Las colas existentes en el virtual host `/` se mantienen: no se borran ni migran mensajes.
Retencion principal: 1 hora. DLQ: 7 dias. Hasta tres reentregas.
NACK sin requeue envia errores permanentes al DLX.
NACK con requeue reintenta errores transitorios de manera acotada.
Alcance: configuracion local y archivos para EC2, sin crear recursos pagados.

## Seguridad

Agregar validacion JWT de Azure para `/api/**` y `/v2/usuarios/sync-azure`.
Validar firma, expiracion, issuer y audience.
Solicitar el rol Azure `Rabbit.Admin` en `/api/**`.
La sincronizacion recibe la identidad del JWT validado.
Mantener la politica existente de los demas endpoints por ahora.
Pruebas propuestas: 401 sin token o token invalido, 403 sin rol, acceso con rol.

## Implicaciones

Es necesario crear/asignar el rol en Azure y registrar el redirect URI del frontend.
Los scripts antiguos que llamaban `/api/**` sin token deberan autenticar.
El nuevo virtual host requiere credenciales configuradas por variables de entorno.
Para terminar la seguridad de la tienda tambien hay que revisar autorizacion por
propietario en boletas, usuarios y carrito, fuera de este cambio acotado.
