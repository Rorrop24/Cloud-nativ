package cl.puntogamer.notifications;
import cl.puntogamer.messaging.MessagingConfiguration;
import cl.puntogamer.messaging.ServiceSecurityConfiguration;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Import;
@SpringBootApplication
@Import({MessagingConfiguration.class, ServiceSecurityConfiguration.class})
public class NotificationsApplication {
    public static void main(String[] args) { SpringApplication.run(NotificationsApplication.class, args); }
}
