package cl.tiendalevelup.messaging.pedidos;
import cl.puntogamer.messaging.*;
import com.rabbitmq.client.Channel;
import java.io.IOException;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
@Component
public class PedidoConsumer {
    private final ManualAcknowledgement acknowledgement; private final EventStore store;
    public PedidoConsumer(ManualAcknowledgement acknowledgement,EventStore store){this.acknowledgement=acknowledgement;this.store=store;}
    @RabbitListener(queues="${app.messaging.pedidos.queue}",ackMode="MANUAL")
    public void consume(Message message,Channel channel) throws IOException {
        acknowledgement.process("pedidos",message,channel,message.getMessageProperties().getDeliveryTag(),body ->
            store.process("pedidos",acknowledgement.id(message),body.path("boletaId").asText(body.path("idPedido").asText()),()->{}));
    }
}
