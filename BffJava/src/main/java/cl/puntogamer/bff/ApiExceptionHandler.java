package cl.puntogamer.bff;

import java.net.SocketTimeoutException;
import java.util.Map;
import jakarta.validation.ConstraintViolationException;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.*;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(RestClientResponseException.class)
    ResponseEntity<Map<String, String>> upstream(RestClientResponseException error) {
        int code = error.getStatusCode().value();
        HttpStatusCode status = code >= 400 && code < 500 ? error.getStatusCode() : HttpStatus.BAD_GATEWAY;
        var response = ResponseEntity.status(status);
        if (status.value() == 401) response.header(HttpHeaders.WWW_AUTHENTICATE, "Bearer");
        return response.body(Map.of("error", "El backend no pudo completar la solicitud"));
    }

    @ExceptionHandler(ResourceAccessException.class)
    ResponseEntity<Map<String, String>> unavailable(ResourceAccessException error) {
        Throwable cause = error;
        while (cause.getCause() != null) cause = cause.getCause();
        HttpStatus status = cause instanceof SocketTimeoutException ? HttpStatus.GATEWAY_TIMEOUT : HttpStatus.BAD_GATEWAY;
        return ResponseEntity.status(status).body(Map.of("error", "Backend no disponible"));
    }

    @ExceptionHandler({IllegalStateException.class, RestClientException.class})
    ResponseEntity<Map<String, String>> badGateway(Exception error) {
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of("error", "Respuesta de backend invalida"));
    }

    @ExceptionHandler(ConstraintViolationException.class)
    ResponseEntity<Map<String, String>> validation(ConstraintViolationException error) {
        return ResponseEntity.badRequest().body(Map.of("error", "Nombre de cola invalido"));
    }
}
