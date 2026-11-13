package cl.puntogamer.kafkaadmin;

import cl.puntogamer.streaming.StreamSecurityConfiguration;
import cl.puntogamer.streaming.StreamTopicsConfiguration;
import cl.puntogamer.streaming.StreamingConfiguration;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Import;

@SpringBootApplication
@Import({StreamingConfiguration.class, StreamTopicsConfiguration.class, StreamSecurityConfiguration.class})
public class KafkaAdminApplication {
    public static void main(String[] args) {
        SpringApplication.run(KafkaAdminApplication.class, args);
    }
}
