package cl.puntogamer.analytics;

import cl.puntogamer.streaming.StreamingProperties;
import org.apache.kafka.common.TopicPartition;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.util.backoff.FixedBackOff;

@Configuration
public class AnalyticsConfiguration {
    private static final Logger log = LoggerFactory.getLogger(AnalyticsConfiguration.class);

    /**
     * Spring Boot aplica este manejador a todos los @KafkaListener. Una falla
     * transitoria se reintenta dos veces con un segundo de espera; un error de
     * formato no se reintenta porque nunca se corregira solo. En ambos casos el
     * mensaje original termina en el topic DLT, en la misma particion, con la causa
     * en las cabeceras, y el consumidor sigue con el siguiente mensaje.
     */
    @Bean
    public DefaultErrorHandler kafkaErrorHandler(KafkaTemplate<String, Object> template, StreamingProperties properties) {
        DeadLetterPublishingRecoverer recoverer = new DeadLetterPublishingRecoverer(template,
                (record, error) -> new TopicPartition(properties.topics().deadLetterFor(record.topic()), record.partition()));
        DefaultErrorHandler handler = new DefaultErrorHandler(recoverer, new FixedBackOff(1000L, 2L));
        // Payload invalido (JSON roto o DTO que no pasa la validacion): directo al DLT.
        handler.addNotRetryableExceptions(IllegalArgumentException.class);
        handler.setRetryListeners((record, error, attempt) -> log.warn(
                "[KAFKA RETRY] topic={} particion={} offset={} intento={} causa={}", record.topic(),
                record.partition(), record.offset(), attempt, error.getMessage()));
        return handler;
    }
}
