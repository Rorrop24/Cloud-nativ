package cl.puntogamer.streaming;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;
import org.springframework.kafka.core.KafkaAdmin;

/**
 * Declara los seis topics. KafkaAdmin los crea al arrancar si aun no existen,
 * de modo que el orden de arranque entre servicios y brokers no importa.
 */
@Configuration
public class StreamTopicsConfiguration {

    @Bean
    public KafkaAdmin.NewTopics projectTopics(StreamingProperties properties) {
        NewTopic[] topics = properties.topics().all().stream()
                .map(name -> TopicBuilder.name(name).partitions(properties.partitions())
                        .replicas(properties.replicationFactor()).build())
                .toArray(NewTopic[]::new);
        return new KafkaAdmin.NewTopics(topics);
    }
}
