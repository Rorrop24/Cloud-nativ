package cl.puntogamer.streaming;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.concurrent.CompletableFuture;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;

/** Publica eventos JSON. La clave decide la particion y conserva el orden por entidad. */
public class StreamPublisher {
    private static final Logger log = LoggerFactory.getLogger(StreamPublisher.class);
    private final KafkaTemplate<String, String> template;
    private final ObjectMapper mapper;

    public StreamPublisher(KafkaTemplate<String, String> template, ObjectMapper mapper) {
        this.template = template;
        this.mapper = mapper;
    }

    public CompletableFuture<SendResult<String, String>> publish(String topic, String key, Object payload) {
        try {
            return publishRaw(topic, key, mapper.writeValueAsString(payload));
        } catch (JsonProcessingException error) {
            throw new IllegalArgumentException("El evento no se puede convertir a JSON", error);
        }
    }

    /** Envia el texto tal cual; se usa para probar mensajes invalidos y el topic de errores. */
    public CompletableFuture<SendResult<String, String>> publishRaw(String topic, String key, String value) {
        CompletableFuture<SendResult<String, String>> future = template.send(topic, key, value);
        future.whenComplete((result, error) -> {
            if (error != null) {
                log.error("[KAFKA PRODUCER ERROR] topic={} key={} causa={}", topic, key, error.toString());
            } else {
                log.info("[KAFKA PRODUCER ACK] topic={} particion={} offset={} key={}", topic,
                        result.getRecordMetadata().partition(), result.getRecordMetadata().offset(), key);
            }
        });
        return future;
    }
}
