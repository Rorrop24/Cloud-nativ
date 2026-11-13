package cl.puntogamer.streaming;

import com.fasterxml.jackson.databind.ObjectMapper;
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
    public StreamPublisher streamPublisher(KafkaTemplate<String, String> template, ObjectMapper mapper) {
        return new StreamPublisher(template, mapper);
    }
}
