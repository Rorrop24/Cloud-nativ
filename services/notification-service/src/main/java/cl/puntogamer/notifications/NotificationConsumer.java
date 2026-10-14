package cl.puntogamer.notifications;
import cl.puntogamer.messaging.*;
import com.rabbitmq.client.Channel;
import java.io.IOException;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
@Component
public class NotificationConsumer {
    private final ManualAcknowledgement acknowledgement;private final EventStore store;private final JdbcTemplate jdbc;
    public NotificationConsumer(ManualAcknowledgement acknowledgement,EventStore store,JdbcTemplate jdbc){this.acknowledgement=acknowledgement;this.store=store;this.jdbc=jdbc;}
    @RabbitListener(queues="${app.messaging.notificaciones.queue}",ackMode="MANUAL")
    public void consume(Message message,Channel channel)throws IOException{
        String id=acknowledgement.id(message);
        acknowledgement.process("notificaciones",message,channel,message.getMessageProperties().getDeliveryTag(),body->
            store.process("notificaciones",id,body.path("boletaId").asText(),()->{
                String title="Comprobante Punto Gamer #"+body.path("boletaId").asText(body.path("idPedido").asText("Prueba"));
                StringBuilder html=new StringBuilder("""
                    <!doctype html><html lang="es"><meta charset="utf-8">
                    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
                    <title>Punto Gamer</title><h1>
                    """).append(escape(title)).append("</h1><p>Compra registrada en Punto Gamer.</p><ul>");
                for(var item:body.path("items"))html.append("<li>").append(escape(item.path("productoId").asText())).append(" - cantidad: ").append(item.path("cantidad").asInt()).append("</li>");
                html.append("</ul><p>Total CLP: ").append(escape(body.path("total").asText("0"))).append("</p><p>Evento: ").append(escape(id)).append("</p></html>");
                jdbc.update("INSERT INTO notification_documents(event_id,owner,boleta_id,title,content) VALUES (?,?,?,?,?)",id,body.path("owner").asText(),body.has("boletaId")?body.path("boletaId").asLong():null,title,html.toString());
            }));
    }
    static String escape(String value){return value.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace("\"","&quot;").replace("'","&#39;");}
}
