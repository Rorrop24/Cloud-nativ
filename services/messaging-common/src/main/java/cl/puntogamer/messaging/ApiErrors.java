package cl.puntogamer.messaging;
import java.util.Map;
import org.springframework.http.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
@RestControllerAdvice
public class ApiErrors {
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<?> invalid(MethodArgumentNotValidException error) {
        var fields=error.getBindingResult().getFieldErrors().stream().map(e->e.getField()+": "+e.getDefaultMessage()).toList();
        return ResponseEntity.badRequest().body(Map.of("error","Entrada invalida","fields",fields));
    }
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<?> invalidArgument(IllegalArgumentException error) { return ResponseEntity.badRequest().body(Map.of("error",error.getMessage())); }

    @ExceptionHandler(org.springframework.web.server.ResponseStatusException.class)
    public ResponseEntity<?> rejected(org.springframework.web.server.ResponseStatusException error){return ResponseEntity.status(error.getStatusCode()).body(Map.of("error",error.getReason()==null?"Solicitud rechazada":error.getReason()));}
    @ExceptionHandler(org.springframework.web.client.HttpClientErrorException.class)
    public ResponseEntity<?> upstream(org.springframework.web.client.HttpClientErrorException error){return ResponseEntity.status(error.getStatusCode()).body(Map.of("error","El backend rechazo la solicitud"));}
    @ExceptionHandler(org.springframework.amqp.AmqpException.class)
    public ResponseEntity<?> broker(org.springframework.amqp.AmqpException error){return ResponseEntity.status(503).body(Map.of("error","RabbitMQ no esta disponible o el recurso es incompatible"));}
}
