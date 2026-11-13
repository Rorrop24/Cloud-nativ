package cl.puntogamer.analytics;

import cl.puntogamer.streaming.StreamingProperties;
import org.apache.kafka.common.TopicPartition;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.util.backoff.FixedBackOff;

@Configuration
public class AnalyticsConfiguration {

    /**
     * Spring Boot aplica este manejador a todos los @KafkaListener: dos reintentos con
     * un segundo de espera y, si sigue fallando, el mensaje original pasa al topic DLT
     * en la misma particion, con la causa en las cabeceras.
     */
    @Bean
    public DefaultErrorHandler kafkaErrorHandler(KafkaTemplate<String, String> template, StreamingProperties properties) {
        DeadLetterPublishingRecoverer recoverer = new DeadLetterPublishingRecoverer(template,
                (record, error) -> new TopicPartition(properties.topics().deadLetterFor(record.topic()), record.partition()));
        return new DefaultErrorHandler(recoverer, new FixedBackOff(1000L, 2L));
    }
}
