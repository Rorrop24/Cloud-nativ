package cl.puntogamer.streaming;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import java.nio.charset.StandardCharsets;
import org.apache.kafka.common.errors.SerializationException;
import org.apache.kafka.common.serialization.Serializer;

/**
 * Serializer de valores para todos los productores del proyecto
 * (spring.kafka.producer.value-serializer). Los DTO de eventos se escriben como
 * JSON UTF-8. Un String se envia tal cual: lo usan las pruebas de mensajes
 * invalidos y el reenvio al DLT, que debe conservar el mensaje original.
 */
public class EventJsonSerializer implements Serializer<Object> {
    private final ObjectMapper mapper = JsonMapper.builder().findAndAddModules().build();

    @Override
    public byte[] serialize(String topic, Object data) {
        if (data == null) {
            return null;
        }
        if (data instanceof byte[] bytes) {
            return bytes;
        }
        if (data instanceof String text) {
            return text.getBytes(StandardCharsets.UTF_8);
        }
        try {
            return mapper.writeValueAsBytes(data);
        } catch (JsonProcessingException error) {
            throw new SerializationException("No se pudo serializar " + data.getClass().getSimpleName()
                    + " para el topic " + topic, error);
        }
    }
}
