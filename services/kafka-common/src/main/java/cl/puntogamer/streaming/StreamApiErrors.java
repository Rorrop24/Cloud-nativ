package cl.puntogamer.streaming;

import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class StreamApiErrors {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<?> invalid(MethodArgumentNotValidException error) {
        List<String> fields = error.getBindingResult().getFieldErrors().stream()
                .map(field -> field.getField() + ": " + field.getDefaultMessage()).toList();
        return ResponseEntity.badRequest().body(Map.of("error", "Entrada invalida", "fields", fields));
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    public ResponseEntity<?> invalidParameter(HandlerMethodValidationException error) {
        return ResponseEntity.badRequest().body(Map.of("error", "Parametro invalido"));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<?> invalidArgument(IllegalArgumentException error) {
        return ResponseEntity.badRequest().body(Map.of("error", String.valueOf(error.getMessage())));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<?> rejected(ResponseStatusException error) {
        String reason = error.getReason() == null ? "Solicitud rechazada" : error.getReason();
        return ResponseEntity.status(error.getStatusCode()).body(Map.of("error", reason));
    }
}
