# EP3: pauta → código → evidencia

Cada indicador de la pauta EP3 (DSY1107) con el lugar del código que lo cumple y la evidencia que lo muestra. Las rutas de archivo son relativas a la raíz del repositorio; los pasos de evidencia están en [EP3-aws.md](EP3-aws.md#evidencias).

| # | Indicador (peso) | Dónde está en el código | Evidencia |
|---|---|---|---|
| 1 | Configuración completa del cliente Kafka (12) | `services/kafka-common/src/main/resources/kafka-defaults.properties` (brokers, particiones, réplicas, `min.insync`); `Backend/src/main/resources/application-streaming.properties` (productor: serializers, `acks=all`, idempotencia, reintentos, compresión, timeouts); `services/kafka-analytics-service/src/main/resources/application.properties` (consumidores: deserializers, grupos, `read_committed`, `CooperativeStickyAssignor`, `concurrency=3`, commit manual) | `/health/kafka-admin` con `"brokers":3`; logs `[KAFKA PRODUCER ACK]` con partición y offset |
| 2 | Productores y consumidores con DTO en los dos topics (12) | DTO: `services/kafka-common/src/main/java/cl/puntogamer/streaming/events/` (`VentaRegistradaEvent`, `ProductoVendidoEvent`, `ResumenAnaliticaEvent`). Escritura: `Backend/.../streaming/VentaStreamProducer.java`. Lectura: `services/kafka-analytics-service/.../SalesStreamConsumer.java` | Compra real → **Leer ventas.eventos** y **Leer ventas.items** muestran el JSON de cada DTO; el panel suma la venta |
| 3 | Administrador: crear, listar y mantener topics y configuraciones (6) | `services/kafka-admin-service/.../KafkaAdminController.java` y `KafkaClusterService.java`: crear con configuración, listar con retención y limpieza, ver y modificar configuración, restablecer una propiedad, aumentar particiones, eliminar (protege los de negocio), sincronizar lo declarado | Administración → Kafka y analítica → Topics y Configuración del topic |
| 4 | Productores con DTO y serializers adecuados (14) | `StreamPublisher.java` (valida el DTO con Bean Validation antes de enviar), `EventJsonSerializer.java` (DTO → JSON UTF-8), `StringSerializer` para claves. Clave = boleta o producto para ordenar por entidad. Publicación después del commit de la compra (`TransactionSynchronization.afterCommit`) | Logs `[KAFKA PRODUCER ACK] ... tipo=VentaRegistradaEvent`; prueba `StreamingPropertiesTest.serializerWritesDtoAsJsonAndKeepsRawText` |
| 5 | Consumidores con `@KafkaListener` y lógica separada (14) | `SalesStreamConsumer.java` (tres `@KafkaListener`: lee, convierte a DTO, valida) delega en `AnalyticsState.java` (lógica de negocio sin dependencias de Kafka) | Logs `[KAFKA CONSUMER] grupo=... boletaId=...`; pruebas `AnalyticsStateTest` |
| 6 | Manejo de errores: logging, validación, reintentos (12) | `AnalyticsConfiguration.java` (`DefaultErrorHandler`: payload inválido directo al DLT, fallas transitorias 2 reintentos, `[KAFKA RETRY]`), `DeadLetterPublishingRecoverer` a `*.DLT`, consumidor `analitica-dlt`; deduplicación por offset en `AnalyticsState.firstTime` | Botón **Enviar inválido al DLT** → logs `[KAFKA CONSUMER ERROR]` y `[KAFKA DLT]`, contador *Mensajes en DLT* |
| 7 | Parámetros de topics: retención, cleanup policy, particiones, réplicas (12) | `kafka-defaults.properties` (por topic: 7 d ventas, 14 d DLT, 1 d pruebas, resumen `compact`); `StreamingProperties.topicConfigs()`; `StreamTopicsConfiguration.java` (`TopicBuilder` con configs, `modify-topic-configs=true`); `DeclaredConfigInitializer.java` | Tabla de topics con columnas Retención y Limpieza; Kafka-UI → Settings; `kafka-topics --describe` en la EC2 |
| 8 | Consumer groups para balanceo y resiliencia (12) | Tres grupos con responsabilidades separadas en `SalesStreamConsumer.java`; `spring.kafka.listener.concurrency=3` y asignador cooperativo en `application.properties` de analítica | **Ver miembros y particiones** de `analitica-ventas`: tres miembros, una partición cada uno; `kafka-consumer-groups --describe --all-groups` |
| 9 | Operaciones replicables sobre topics y consumer groups (6) | API del administrador (topics, configuración, particiones, grupos, lag, reinicio de offsets) y scripts de infraestructura: `infra/terraform/kafka.tf`, `templates/kafka-cloud-init.sh.tftpl` (crea los topics desde `kafka-defaults.properties`), `templates/kafka-compose.yml` | `terraform output kafka_topics`; Administración → Kafka; Postman o curl con el JWT |

## Instrucciones específicas

| Requisito | Dónde |
|---|---|
| Backend compila, buenas prácticas, pruebas básicas | `./mvnw.cmd clean verify` compila y prueba los diez módulos |
| Frontend Angular modular y funcional | `FrontendAngular/` (pestaña Kafka y analítica en `src/app/ui/admin.html`) |
| Base de datos cloud con entidades, repositorios y propiedades | `Backend/src/main/java/cl/tiendalevelup/Entity`, `Repository`, `application-aws.properties` (RDS MySQL) |
| Filtros que validan el JWT del IDaaS | `Backend/.../security/`, `messaging-common/.../ServiceSecurityConfiguration.java`, `kafka-common/.../StreamSecurityConfiguration.java` |
| Login con IDaaS y JWT en las llamadas | `FrontendAngular/src/app/auth/` (MSAL + interceptor) |
| `.gitignore` por tecnología | `.gitignore` raíz y de cada proyecto |
| Productores, consumidores, DLQ y logs en RabbitMQ | `services/messaging-common`, consumidores de inventario y notificaciones |
| Administrador RabbitMQ: colas, exchanges, bindings | `services/rabbit-admin-service` |
| Productores y consumidores Kafka | Indicadores 2, 4 y 5 |
| Administrador Kafka: crear, modificar y eliminar topics y configuraciones | Indicador 3 |
| docker-compose de cluster RabbitMQ | `infra/terraform/templates/docker-compose.yml.tftpl`, `Backend/rabbitmq/docker-compose.yml` |
| docker-compose de Kafka con Zookeeper y brokers | `infra/terraform/templates/kafka-compose.yml` |
| docker-compose de Kafka-UI | El mismo `kafka-compose.yml` (servicio `kafka-ui`, puerto 8095) |
