# Evaluacion Parcial 2 - Level-Up Gamer

## Alcance

Conservar React (autorizado por el estudiante), Spring Boot y el flujo de compra.
Agregar mensajeria verificable y un administrador RabbitMQ independiente.
Las correcciones especificas de EP1 quedan pendientes de recibir la retroalimentacion.

## Entregables

- Frontend responsive: catalogo, carrito y panel de mensajeria.
- Backend: productores JSON, consumidores por dominio y ACK/NACK explicitos.
- Rabbit Admin: colas, exchanges, bindings, validacion y metricas reales.
- Infraestructura: cluster Docker Compose de tres nodos y colas quorum.
- Seguridad: validacion Azure JWT, audiencia y permisos de administrador.
- Guia EC2, pruebas reproducibles y guion para la defensa tecnica.

## Topologia

Dos exchanges direct: `pedidos.exchange` y `pedidos.dlx`.
Seis colas: tres principales y una DLQ por dominio.

| Dominio | Cola | Routing key | DLQ | Clave DLQ |
| --- | --- | --- | --- | --- |
| Pedidos | pedidos.queue | pedido.creado | pedidos.dlq | pedidos.dead |
| Notificaciones | notificaciones.queue | pedido.notificacion | notificaciones.dlq | notificaciones.dead |
| Inventario | inventario.queue | pedido.stock | inventario.dlq | inventario.dead |

Las colas quorum se replican en tres nodos. Un cluster en una sola EC2
tolera la caida de un contenedor, pero no la perdida de la instancia.
La retencion, limite de longitud y numero de entregas se centralizan en RabbitMQConfig.

## Evidencias necesarias

1. Compilacion frontend y backend y resultados de pruebas.
2. Login Azure; 401 sin token y con token invalido; 403 sin rol Rabbit.Admin.
3. Publicacion JSON y consumo exitoso con ACK.
4. Rechazo no recuperable con NACK sin requeue y mensaje en DLQ.
5. Reintento recuperable acotado, sin ciclo infinito.
6. Alta y baja de una cola, exchange y binding de prueba.
7. Cluster con tres nodos; caida de un nodo y continuidad de una cola quorum.
8. Dashboard RabbitMQ y logs con el mismo identificador de evento.

Registrar fecha, resultado real y captura/log de cada caso. No presentar
pruebas simuladas o no ejecutadas como evidencia de despliegue.
