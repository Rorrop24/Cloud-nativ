package cl.puntogamer.streaming;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;
import org.springframework.kafka.core.KafkaAdmin;

/**
 * Declara los seis topics con particiones, replicas, retencion y politica de
 * limpieza. KafkaAdmin los crea al arrancar si faltan y, con
 * spring.kafka.admin.modify-topic-configs=true, corrige la configuracion de los
 * que ya existen.
 */
@Configuration
public class StreamTopicsConfiguration {

    @Bean
    public KafkaAdmin.NewTopics projectTopics(StreamingProperties properties) {
        NewTopic[] topics = properties.topicConfigs().entrySet().stream()
                .map(entry -> TopicBuilder.name(entry.getKey()).partitions(properties.partitions())
                        .replicas(properties.replicationFactor()).configs(entry.getValue()).build())
                .toArray(NewTopic[]::new);
        return new KafkaAdmin.NewTopics(topics);
    }
}
