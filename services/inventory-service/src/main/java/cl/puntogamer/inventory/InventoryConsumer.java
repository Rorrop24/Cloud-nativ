package cl.puntogamer.inventory;
import cl.puntogamer.messaging.*;
import com.rabbitmq.client.Channel;
import java.io.IOException;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
@Component
public class InventoryConsumer {
    private final ManualAcknowledgement acknowledgement;private final EventStore store;private final JdbcTemplate jdbc;
    public InventoryConsumer(ManualAcknowledgement acknowledgement,EventStore store,JdbcTemplate jdbc){this.acknowledgement=acknowledgement;this.store=store;this.jdbc=jdbc;}
    @RabbitListener(queues="${app.messaging.inventario.queue}",ackMode="MANUAL")
    public void consume(Message message,Channel channel)throws IOException{
        String id=acknowledgement.id(message);
        acknowledgement.process("inventario",message,channel,message.getMessageProperties().getDeliveryTag(),body->
            store.process("inventario",id,body.path("boletaId").asText(),()->{
                // Stock is reserved atomically by the order transaction. Register the resulting movement, never debit twice.
                for(var item:body.path("items")){
                    String product=item.path("productoId").asText();int quantity=item.path("cantidad").asInt();
                    if(product.isBlank()||quantity<=0)throw new IllegalArgumentException("Movimiento de inventario invalido");
                    Integer stock=item.has("stockAfter")?item.path("stockAfter").asInt():jdbc.queryForObject("SELECT stock FROM productos WHERE id=?",Integer.class,product);
                    jdbc.update("INSERT INTO inventory_movements(event_id,product_id,boleta_id,quantity,stock_after) VALUES (?,?,?,?,?)",id,product,body.path("boletaId").asLong(),quantity,stock);
                }
            }));
    }
}
