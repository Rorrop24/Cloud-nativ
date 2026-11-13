package cl.puntogamer.analytics;

import cl.puntogamer.streaming.StreamSecurityConfiguration;
import cl.puntogamer.streaming.StreamTopicsConfiguration;
import cl.puntogamer.streaming.StreamingConfiguration;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Import;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@Import({StreamingConfiguration.class, StreamTopicsConfiguration.class, StreamSecurityConfiguration.class})
public class AnalyticsApplication {
    public static void main(String[] args) {
        SpringApplication.run(AnalyticsApplication.class, args);
    }
}
