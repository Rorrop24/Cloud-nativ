package cl.tiendalevelup.config;
import cl.puntogamer.messaging.MessagingConfiguration;
import org.springframework.context.annotation.*;
@Configuration @Import(MessagingConfiguration.class)
public class RabbitMQConfig {}
