package cl.puntogamer.analytics;

import cl.puntogamer.streaming.StreamingProperties;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.common.TopicPartition;
import org.apache.kafka.common.header.Header;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.listener.AbstractConsumerSeekAware;
import org.springframework.stereotype.Component;

/**
 * Tres grupos de consumidores: ventas, productos y mensajes fallidos (DLT).
 * Un mensaje invalido lanza una excepcion; el manejador de errores lo reintenta
 * y luego lo publica en el topic DLT correspondiente.
 */
@Component
public class SalesStreamConsumer extends AbstractConsumerSeekAware {
    private static final Logger log = LoggerFactory.getLogger(SalesStreamConsumer.class);
    private final AnalyticsState state;
    private final ObjectMapper mapper;
    private final StreamingProperties properties;
    /** Posicion confirmada de cada particion al asignarse: lo anterior ya se proceso en otra ejecucion. */
    private final Map<TopicPartition, Long> committed = new ConcurrentHashMap<>();

    public SalesStreamConsumer(AnalyticsState state, ObjectMapper mapper, StreamingProperties properties) {
        this.state = state;
        this.mapper = mapper;
        this.properties = properties;
    }

    @Override
    public void onPartitionsAssigned(Map<TopicPartition, Long> assignments, ConsumerSeekCallback callback) {
        super.onPartitionsAssigned(assignments, callback);
        committed.putAll(assignments);
        // El estado vive en memoria: se relee cada particion desde el inicio para reconstruirlo.
        callback.seekToBeginning(assignments.keySet());
    }

    @KafkaListener(id = "analitica-ventas", groupId = "analitica-ventas", topics = "${app.kafka.topics.ventas}")
    public void sale(ConsumerRecord<String, String> record) {
        JsonNode event = read(record, "boletaId", "total");
        if (event != null) {
            state.sale(event);
            log.info("[KAFKA CONSUMER] grupo=analitica-ventas particion={} offset={} boletaId={}",
                    record.partition(), record.offset(), event.path("boletaId").asText());
        }
    }

    @KafkaListener(id = "analitica-productos", groupId = "analitica-productos", topics = "${app.kafka.topics.items}")
    public void item(ConsumerRecord<String, String> record) {
        JsonNode event = read(record, "productoId", "cantidad");
        if (event != null) {
            state.item(event);
            log.info("[KAFKA CONSUMER] grupo=analitica-productos particion={} offset={} productoId={}",
                    record.partition(), record.offset(), event.path("productoId").asText());
        }
    }

    @KafkaListener(id = "analitica-dlt", groupId = "analitica-dlt",
            topics = {"${app.kafka.topics.ventas-dlt}", "${app.kafka.topics.items-dlt}"})
    public void deadLetter(ConsumerRecord<String, String> record) {
        if (!state.firstTime(record.topic(), record.partition(), record.offset())) {
            return;
        }
        Header reason = record.headers().lastHeader("kafka_dlt-exception-message");
        String message = reason == null ? "sin detalle" : new String(reason.value(), StandardCharsets.UTF_8);
        state.deadLetter(record.topic(), record.partition(), record.offset(), record.value(), message);
        log.warn("[KAFKA DLT] topic={} particion={} offset={} causa={}", record.topic(), record.partition(),
                record.offset(), message);
    }

    /**
     * Devuelve el evento, o null si ya estaba aplicado. Lanza IllegalArgumentException
     * si el mensaje es invalido y aun no fue derivado al DLT.
     */
    private JsonNode read(ConsumerRecord<String, String> record, String... required) {
        TopicPartition partition = new TopicPartition(record.topic(), record.partition());
        boolean replay = record.offset() < committed.getOrDefault(partition, 0L);
        try {
            JsonNode event = parse(record.value(), required);
            return state.firstTime(record.topic(), record.partition(), record.offset()) ? event : null;
        } catch (IllegalArgumentException invalid) {
            if (replay) {
                // Ya se envio al DLT en una ejecucion anterior; no se duplica.
                state.firstTime(record.topic(), record.partition(), record.offset());
                return null;
            }
            log.warn("[KAFKA CONSUMER ERROR] topic={} particion={} offset={} causa={}", record.topic(),
                    record.partition(), record.offset(), invalid.getMessage());
            throw invalid;
        }
    }

    JsonNode parse(String value, String... required) {
        JsonNode event;
        try {
            event = mapper.readTree(value == null ? "" : value);
        } catch (JsonProcessingException error) {
            throw new IllegalArgumentException("El mensaje no es JSON valido");
        }
        if (event == null || !event.isObject()) {
            throw new IllegalArgumentException("El mensaje no es un objeto JSON");
        }
        for (String field : required) {
            if (!event.hasNonNull(field)) {
                throw new IllegalArgumentException("Falta el campo obligatorio " + field);
            }
        }
        return event;
    }

    /** Para el manejador de errores: destino DLT segun kafka-defaults.properties. */
    String deadLetterTopic(String topic) {
        return properties.topics().deadLetterFor(topic);
    }
}
