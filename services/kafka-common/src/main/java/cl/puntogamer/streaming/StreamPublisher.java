package cl.puntogamer.streaming;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;

/**
 * Publica eventos. La clave decide la particion y conserva el orden por entidad.
 * Los DTO se validan antes de enviarse: un evento mal formado nunca llega al topic.
 */
public class StreamPublisher {
    private static final Logger log = LoggerFactory.getLogger(StreamPublisher.class);
    private final KafkaTemplate<String, Object> template;
    private final Validator validator;

    public StreamPublisher(KafkaTemplate<String, Object> template, Validator validator) {
        this.template = template;
        this.validator = validator;
    }

    /** Envia un DTO; EventJsonSerializer lo convierte a JSON. */
    public CompletableFuture<SendResult<String, Object>> publish(String topic, String key, Object event) {
        if (event == null || event instanceof String) {
            throw new IllegalArgumentException("publish espera un DTO; usar publishRaw para texto");
        }
        validate(event);
        return send(topic, key, event);
    }

    /** Envia el texto tal cual; se usa para probar mensajes invalidos y el topic de errores. */
    public CompletableFuture<SendResult<String, Object>> publishRaw(String topic, String key, String value) {
        return send(topic, key, value);
    }

    private CompletableFuture<SendResult<String, Object>> send(String topic, String key, Object value) {
        CompletableFuture<SendResult<String, Object>> future = template.send(topic, key, value);
        future.whenComplete((result, error) -> {
            if (error != null) {
                log.error("[KAFKA PRODUCER ERROR] topic={} key={} causa={}", topic, key, error.toString());
            } else {
                log.info("[KAFKA PRODUCER ACK] topic={} particion={} offset={} key={} tipo={}", topic,
                        result.getRecordMetadata().partition(), result.getRecordMetadata().offset(), key,
                        value.getClass().getSimpleName());
            }
        });
        return future;
    }

    private void validate(Object event) {
        if (validator == null) {
            return;
        }
        Set<ConstraintViolation<Object>> violations = validator.validate(event);
        if (!violations.isEmpty()) {
            String detail = violations.stream().map(v -> v.getPropertyPath() + " " + v.getMessage())
                    .sorted().collect(Collectors.joining(", "));
            throw new IllegalArgumentException(event.getClass().getSimpleName() + " invalido: " + detail);
        }
    }
}
