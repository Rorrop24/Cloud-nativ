package cl.puntogamer.messaging;
import java.util.concurrent.TimeUnit;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.rabbit.connection.CorrelationData;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
public class ConfirmedPublisher {
    private final RabbitTemplate template;
    public ConfirmedPublisher(RabbitTemplate template) { this.template = template; }
    public void send(String exchange, String key, Object body, String id) {
        var correlation = new CorrelationData(id);
        template.convertAndSend(exchange, key, body, message -> {
            message.getMessageProperties().setMessageId(id);
            message.getMessageProperties().setDeliveryMode(MessageDeliveryMode.PERSISTENT);
            return message;
        }, correlation);
        confirm(correlation);
    }
    public void retry(String exchange, String key, Message message, int attempt, String id) {
        message.getMessageProperties().setHeader("x-attempt", attempt);
        message.getMessageProperties().setMessageId(id);
        var correlation = new CorrelationData(id + "-retry-" + attempt);
        template.send(exchange, key, message, correlation);
        confirm(correlation);
    }
    private void confirm(CorrelationData correlation) {
        try {
            var confirmation = correlation.getFuture().get(10, TimeUnit.SECONDS);
            if (!confirmation.isAck() || correlation.getReturned() != null) throw new IllegalStateException("El broker no confirmo el enrutamiento");
        } catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new IllegalStateException("Publicacion interrumpida", e); }
        catch (Exception e) { throw new IllegalStateException("Publicacion no confirmada", e); }
    }
}
