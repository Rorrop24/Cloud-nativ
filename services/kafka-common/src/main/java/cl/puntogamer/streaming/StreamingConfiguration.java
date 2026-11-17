package cl.puntogamer.streaming;

import jakarta.validation.Validator;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.PropertySource;
import org.springframework.kafka.core.KafkaTemplate;

/** Configuracion compartida por todo servicio que publica en Kafka. */
@Configuration
@PropertySource("classpath:kafka-defaults.properties")
@EnableConfigurationProperties(StreamingProperties.class)
public class StreamingConfiguration {

    @Bean
    public StreamPublisher streamPublisher(KafkaTemplate<String, Object> template, ObjectProvider<Validator> validator) {
        return new StreamPublisher(template, validator.getIfAvailable());
    }
}
