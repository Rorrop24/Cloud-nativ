package cl.puntogamer.admin;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import java.util.Map;
import org.springframework.http.*;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
@RestController @Validated @RequestMapping("/api/rabbitmq")
public class RabbitAdminController {
    private final RabbitAdminService service;
    public RabbitAdminController(RabbitAdminService service){this.service=service;}
    @PostMapping("/queues")public ResponseEntity<?> createQueue(@Valid @RequestBody Requests.QueueRequest request){service.createQueue(request);return ResponseEntity.status(201).body(Map.of("queueName",request.queueName()));}
    @GetMapping("/queues/{name}")public ResponseEntity<?> queue(@PathVariable @Pattern(regexp="[a-zA-Z0-9._-]{1,255}")String name){var info=service.info(name);return info==null?ResponseEntity.notFound().build():ResponseEntity.ok(info);}
    @DeleteMapping("/queues/{name}")public ResponseEntity<?> deleteQueue(@PathVariable @Pattern(regexp="[a-zA-Z0-9._-]{1,255}")String name){return service.deleteQueue(name)?ResponseEntity.noContent().build():ResponseEntity.notFound().build();}
    @PostMapping("/exchanges")public ResponseEntity<?> createExchange(@Valid @RequestBody Requests.ExchangeRequest request){service.createExchange(request);return ResponseEntity.status(201).body(Map.of("exchangeName",request.exchangeName()));}
    @DeleteMapping("/exchanges/{name}")public ResponseEntity<?> deleteExchange(@PathVariable @Pattern(regexp="[a-zA-Z0-9._-]{1,255}")String name){return service.deleteExchange(name)?ResponseEntity.noContent().build():ResponseEntity.notFound().build();}
    @PostMapping("/bindings")public ResponseEntity<?> createBinding(@Valid @RequestBody Requests.BindingRequest request){service.createBinding(request);return ResponseEntity.status(201).body(request);}
    @DeleteMapping("/bindings")public ResponseEntity<?> deleteBinding(@Valid @RequestBody Requests.BindingRequest request){service.deleteBinding(request);return ResponseEntity.noContent().build();}
    @GetMapping("/topology")public Map<String,Object> topology(){return service.topology();}
    @PostMapping("/events")public Map<String,Object> event(@Valid @RequestBody Requests.EventRequest request){return service.event(request);}
}
