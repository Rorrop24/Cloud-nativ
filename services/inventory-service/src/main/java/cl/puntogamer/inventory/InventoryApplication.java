package cl.puntogamer.inventory;
import cl.puntogamer.messaging.MessagingConfiguration;
import cl.puntogamer.messaging.ServiceSecurityConfiguration;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Import;
@SpringBootApplication
@Import({MessagingConfiguration.class, ServiceSecurityConfiguration.class})
public class InventoryApplication {
    public static void main(String[] args) { SpringApplication.run(InventoryApplication.class, args); }
}
