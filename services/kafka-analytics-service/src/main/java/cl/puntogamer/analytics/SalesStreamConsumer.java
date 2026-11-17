package cl.puntogamer.analytics;

import cl.puntogamer.streaming.StreamingProperties;
import cl.puntogamer.streaming.events.ProductoVendidoEvent;
import cl.puntogamer.streaming.events.VentaRegistradaEvent;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.common.TopicPartition;
import org.apache.kafka.common.header.Header;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.listener.AbstractConsumerSeekAware;
import org.springframework.stereotype.Component;

/**
 * Capa de mensajeria: lee los topics, convierte cada mensaje en su DTO, lo valida
 * y entrega el evento a AnalyticsState (logica de negocio).
 *
 * Tres consumer groups independientes: cada uno recibe todos los eventos de sus
 * topics, y dentro de cada grupo tres hilos se reparten las particiones.
 * Un mensaje invalido lanza una excepcion; el manejador de errores lo reintenta y
 * luego lo publica en el topic DLT correspondiente.
 */
@Component
public class SalesStreamConsumer extends AbstractConsumerSeekAware {
    private static final Logger log = LoggerFactory.getLogger(SalesStreamConsumer.class);
    private final AnalyticsState state;
    private final ObjectMapper mapper;
    private final Validator validator;
    private final StreamingProperties properties;
    /** Posicion confirmada de cada particion al asignarse: lo anterior ya se proceso en otra ejecucion. */
    private final Map<TopicPartition, Long> committed = new ConcurrentHashMap<>();

    public SalesStreamConsumer(AnalyticsState state, ObjectMapper mapper, Validator validator,
            StreamingProperties properties) {
        this.state = state;
        this.mapper = mapper;
        this.validator = validator;
        this.properties = properties;
    }

    @Override
    public void onPartitionsAssigned(Map<TopicPartition, Long> assignments, ConsumerSeekCallback callback) {
        super.onPartitionsAssigned(assignments, callback);
        committed.putAll(assignments);
        log.info("[KAFKA REBALANCE] particiones asignadas={}", assignments.keySet());
        // El estado vive en memoria: se relee cada particion desde el inicio para reconstruirlo.
        callback.seekToBeginning(assignments.keySet());
    }

    @KafkaListener(id = "analitica-ventas", groupId = "analitica-ventas", topics = "${app.kafka.topics.ventas}")
    public void venta(ConsumerRecord<String, String> record) {
        VentaRegistradaEvent event = read(record, VentaRegistradaEvent.class);
        if (event != null) {
            state.registrarVenta(event);
            log.info("[KAFKA CONSUMER] grupo=analitica-ventas particion={} offset={} boletaId={} total={}",
                    record.partition(), record.offset(), event.boletaId(), event.total());
        }
    }

    @KafkaListener(id = "analitica-productos", groupId = "analitica-productos", topics = "${app.kafka.topics.items}")
    public void producto(ConsumerRecord<String, String> record) {
        ProductoVendidoEvent event = read(record, ProductoVendidoEvent.class);
        if (event != null) {
            state.registrarProducto(event);
            log.info("[KAFKA CONSUMER] grupo=analitica-productos particion={} offset={} productoId={} cantidad={}",
                    record.partition(), record.offset(), event.productoId(), event.cantidad());
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
        state.registrarDlt(record.topic(), record.partition(), record.offset(), record.value(), message);
        log.warn("[KAFKA DLT] topic={} particion={} offset={} causa={}", record.topic(), record.partition(),
                record.offset(), message);
    }

    /**
     * Devuelve el evento, o null si ya estaba aplicado. Lanza IllegalArgumentException
     * si el mensaje es invalido y aun no fue derivado al DLT.
     */
    private <T> T read(ConsumerRecord<String, String> record, Class<T> type) {
        TopicPartition partition = new TopicPartition(record.topic(), record.partition());
        boolean replay = record.offset() < committed.getOrDefault(partition, 0L);
        try {
            T event = parse(record.value(), type);
            return state.firstTime(record.topic(), record.partition(), record.offset()) ? event : null;
        } catch (IllegalArgumentException invalid) {
            if (replay) {
                // Ya se envio al DLT en una ejecucion anterior; no se duplica.
                state.firstTime(record.topic(), record.partition(), record.offset());
                return null;
            }
            log.warn("[KAFKA CONSUMER ERROR] topic={} particion={} offset={} key={} causa={}", record.topic(),
                    record.partition(), record.offset(), record.key(), invalid.getMessage());
            throw invalid;
        }
    }

    /** JSON -> DTO -> Bean Validation. Cualquier falla es IllegalArgumentException. */
    <T> T parse(String value, Class<T> type) {
        T event;
        try {
            event = mapper.readValue(value == null ? "" : value, type);
        } catch (JsonProcessingException error) {
            throw new IllegalArgumentException("El mensaje no es un " + type.getSimpleName() + " en JSON valido");
        }
        if (event == null) {
            throw new IllegalArgumentException("Mensaje vacio");
        }
        Set<ConstraintViolation<T>> violations = validator.validate(event);
        if (!violations.isEmpty()) {
            throw new IllegalArgumentException(type.getSimpleName() + " invalido: " + violations.stream()
                    .map(v -> v.getPropertyPath() + " " + v.getMessage()).sorted().collect(Collectors.joining(", ")));
        }
        return event;
    }

    /** Para el manejador de errores: destino DLT segun kafka-defaults.properties. */
    String deadLetterTopic(String topic) {
        return properties.topics().deadLetterFor(topic);
    }
}
