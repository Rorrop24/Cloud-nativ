package cl.tiendalevelup.Service;
import cl.puntogamer.messaging.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import cl.tiendalevelup.streaming.VentaStreamProducer;
@Service
public class PedidoProducerService {
    private final MessagingProperties properties; private final Outbox outbox;
    // Solo existe con el perfil "streaming"; sin Kafka la compra funciona igual que en EP2.
    @Autowired(required=false) private VentaStreamProducer stream;
    public PedidoProducerService(MessagingProperties properties,Outbox outbox){this.properties=properties;this.outbox=outbox;}
    public String enviarPedido(String id,String message){return publish("pedidos",id,message);}
    public String enviarAInventario(String id,String message){return publish("inventario",id,message);}
    public String enviarANotificaciones(String id,String message){return publish("notificaciones",id,message);}
    private String publish(String domain,String id,String message){return outbox.enqueue(properties.exchange(),properties.route(domain).routingKey(),Map.of("idPedido",id,"mensaje",message));}
    public void publicarEventosDeCompra(Long id,Object items,Double total,String email,String owner){
        var payload=new LinkedHashMap<String,Object>(); payload.put("boletaId",id);payload.put("items",items);payload.put("total",total);
        payload.put("email",email==null?"":email);payload.put("owner",owner==null?"":owner);payload.put("mensaje","Compra registrada; stock reservado");
        for(String domain:List.of("pedidos","inventario","notificaciones"))outbox.enqueue(properties.exchange(),properties.route(domain).routingKey(),payload);
        if(stream!=null)stream.publicarVenta(id,items,total);
    }
}
