package cl.puntogamer.admin;
import cl.puntogamer.messaging.*;
import java.util.*;
import org.slf4j.*;
import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitAdmin;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
@Service
public class RabbitAdminService {
    private static final Logger log=LoggerFactory.getLogger(RabbitAdminService.class);
    private final RabbitAdmin admin;private final MessagingProperties properties;private final ConfirmedPublisher publisher;
    public RabbitAdminService(ConnectionFactory factory,MessagingProperties properties,ConfirmedPublisher publisher){this.admin=new RabbitAdmin(factory);this.properties=properties;this.publisher=publisher;}
    public void createQueue(Requests.QueueRequest request){
        if(coreQueues().contains(request.queueName()))throw new ResponseStatusException(HttpStatus.CONFLICT,"Nombre reservado por el sistema");
        admin.declareQueue(new org.springframework.amqp.core.Queue(request.queueName(),request.isDurable(),false,false,Map.of("x-queue-type",request.type())));
    }
    public boolean deleteQueue(String name){protectQueue(name);return admin.deleteQueue(name);}
    public QueueInformation info(String name){return admin.getQueueInfo(name);}
    public void createExchange(Requests.ExchangeRequest request){protectExchange(request.exchangeName());admin.declareExchange(new CustomExchange(request.exchangeName(),request.exchangeType(),request.isDurable(),false));}
    public boolean deleteExchange(String name){protectExchange(name);return admin.deleteExchange(name);}
    public void createBinding(Requests.BindingRequest request){protectQueue(request.queueName());admin.declareBinding(binding(request));}
    public void deleteBinding(Requests.BindingRequest request){protectQueue(request.queueName());admin.removeBinding(binding(request));}
    private Binding binding(Requests.BindingRequest request){return new Binding(request.queueName(),Binding.DestinationType.QUEUE,request.exchangeName(),request.routingKey(),null);}
    private Set<String> coreQueues(){return Set.of(properties.pedidos().queue(),properties.pedidos().dlq(),properties.inventario().queue(),properties.inventario().dlq(),properties.notificaciones().queue(),properties.notificaciones().dlq());}
    private void protectQueue(String name){if(coreQueues().contains(name))throw new ResponseStatusException(HttpStatus.CONFLICT,"No se elimina ni modifica una cola de negocio");}
    private void protectExchange(String name){if(name.isBlank()||name.startsWith("amq.")||name.equals(properties.exchange())||name.equals(properties.deadLetterExchange()))throw new ResponseStatusException(HttpStatus.CONFLICT,"Exchange protegido");}
    public Map<String,Object> topology(){
        var queues=coreQueues().stream().sorted().map(name->{var info=admin.getQueueInfo(name);return Map.<String,Object>of("name",name,"exists",info!=null,"messages",info==null?0:info.getMessageCount(),"consumers",info==null?0:info.getConsumerCount());}).toList();
        return Map.of("queues",queues,"exchanges",List.of(properties.exchange(),properties.deadLetterExchange()));
    }
    public Map<String,Object> event(Requests.EventRequest request){
        String id=UUID.randomUUID().toString();var route=properties.route(request.domain());
        publisher.send(properties.exchange(),route.routingKey(),Map.of("idPedido",request.reference(),"mensaje",request.message()),id);
        log.info("[PRODUCER CONFIRMED] eventId={} reference={} queue={} brokerACK=true",id,request.reference(),route.queue());
        return Map.of("eventId",id,"reference",request.reference(),"routed",true);
    }
}
