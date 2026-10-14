# Pauta EP2: trazabilidad

| Criterio | Peso | Implementación | Evidencia que falta obtener en AWS |
|---|---:|---|---|
| Nombres centralizados | 12% | `services/messaging-common/.../messaging-defaults.properties`, `MessagingProperties` con `@ConfigurationProperties`; listeners usan `${app.messaging...}` | Mostrar configuración y búsqueda de listeners sin literales |
| Queue, Exchange, Binding y DLQ | 13% | `MessagingConfiguration`: 6 Queue, 2 DirectExchange, 6 Binding, DLX/routing key/TTL | Exchanges y Queues del vhost `levelup` |
| Separación de capas | 10% | Configuración en biblioteca messaging; controllers → services; consumidores por dominio | Estructura en IDE |
| Tres consumidores por dominio | 15% | Backend `messaging/pedidos`; inventory-service `inventory`; notification-service `notifications` | Código y logs de tres aplicaciones |
| ACK/NACK y errores | 20% | `ManualAcknowledgement`: `basicAck`, `log.error`, `basicNack(tag,false,false)`; reintentos y deduplicación | ACK y NACK del evento exacto + contador DLQ |
| REST Admin | 13% | rabbit-admin-service `RabbitAdminController`: crear/eliminar queues, exchanges, bindings; topology y eventos | Postman 201/204/401/403 |
| Servicio Admin encapsulado | 10% | `RabbitAdminService` usa RabbitAdmin; controller no accede al broker directo | Código del controller y service |
| Validación de entrada | 7% | `Requests`, `@Valid`, `@NotBlank`, longitudes/patrones y restricción de quorum durable | Nombre vacío → 400 antes de llamar al broker |

La confirmación manual está en una clase compartida para que los tres listeners apliquen la misma regla: persistir el efecto y su recibo transaccional antes del ACK; rollback y NACK al fallar. Para revisar cada dominio seguir `consume` → `ManualAcknowledgement.process` → `EventStore.process`. El publish de reintento espera confirmación del broker antes de confirmar el original. Si falla el ACK, la excepción llega al contenedor para recuperación; no se emite un segundo ACK/NACK sobre el mismo delivery tag.

Elementos transversales: Angular/MSAL y JWT validado en Java; carrito en MySQL por tid:oid; compra transaccional con precio del servidor y stock condicional; tres eventos durables mediante outbox; comprobantes por usuario; seis ejecutables Spring Boot; build/deploy y .gitignore. RDS se actualiza mediante V2 sin cambiar el checksum de V1.

Las pruebas locales cubren seguridad, validación, persistencia, rollback, idempotencia, deduplicación, publicación confirmada, ACK/NACK y separación de usuarios. Los tests de MySQL con Testcontainers requieren Docker accesible: revisar el reporte por tests omitidos. Las pruebas unitarias/H2 y Terraform simulado no sustituyen la demostración real de RDS, RabbitMQ y Azure.

## Limitaciones declaradas

- Los seis servicios tienen procesos y contenedores propios y comparten RDS; no hay seis bases aisladas.
- Documentos genera HTML almacenado en RDS. No envía emails.
- Checkout registra compra y boleta; no integra un medio de pago real.
- El cluster de tres nodos RabbitMQ reside en una EC2; no tolera la pérdida de esa instancia.
- Código local preparado no significa despliegue AWS confirmado, rol Azure asignado ni evidencias AVA entregadas.
