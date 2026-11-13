package cl.tiendalevelup.streaming;

import cl.puntogamer.streaming.StreamPublisher;
import cl.puntogamer.streaming.StreamingProperties;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.kafka.support.SendResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * Pruebas de streaming para la demostracion. SecurityConfig exige el rol
 * Rabbit.Admin para toda ruta no listada, por lo que /api/streaming queda protegida.
 */
@RestController
@Profile("streaming")
@RequestMapping("/api/streaming")
public class StreamingController {
    private final VentaStreamProducer producer;
    private final StreamPublisher publisher;
    private final StreamingProperties properties;

    public StreamingController(VentaStreamProducer producer, StreamPublisher publisher, StreamingProperties properties) {
        this.producer = producer;
        this.publisher = publisher;
        this.properties = properties;
    }

    @GetMapping("/estado")
    public Map<String, Object> estado() {
        Map<String, Object> estado = new LinkedHashMap<>();
        estado.put("streaming", true);
        estado.put("productor", "Backend");
        estado.put("topicVentas", properties.topics().ventas());
        estado.put("topicItems", properties.topics().items());
        estado.put("particiones", properties.partitions());
        estado.put("replicas", properties.replicationFactor());
        return estado;
    }

    /** modo "venta": evento valido de prueba. modo "invalido": mensaje que debe terminar en el DLT. */
    @PostMapping("/eventos")
    public Map<String, Object> evento(@RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> request = body == null ? Map.of() : body;
        String modo = String.valueOf(request.getOrDefault("modo", "venta"));
        if (modo.equals("invalido")) {
            String clave = "invalido-" + System.currentTimeMillis();
            SendResult<String, String> result = esperar(publisher.publishRaw(properties.topics().ventas(), clave,
                    "MENSAJE-INVALIDO: esto no es JSON"));
            Map<String, Object> respuesta = new LinkedHashMap<>();
            respuesta.put("modo", modo);
            respuesta.put("topic", result.getRecordMetadata().topic());
            respuesta.put("particion", result.getRecordMetadata().partition());
            respuesta.put("offset", result.getRecordMetadata().offset());
            respuesta.put("esperado", "El consumidor reintenta y lo deriva a " + properties.topics().ventasDlt());
            return respuesta;
        }
        if (!modo.equals("venta")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "modo debe ser venta o invalido");
        }
        String productoId = String.valueOf(request.getOrDefault("productoId", "PRUEBA-EP3"));
        if (productoId.isBlank() || productoId.length() > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "productoId invalido");
        }
        Object cantidad = request.getOrDefault("cantidad", 1);
        if (!(cantidad instanceof Number numero) || numero.intValue() < 1 || numero.intValue() > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "cantidad debe estar entre 1 y 100");
        }
        return producer.publicarPrueba(productoId, numero.intValue());
    }

    private static SendResult<String, String> esperar(java.util.concurrent.CompletableFuture<SendResult<String, String>> envio) {
        try {
            return envio.get(15, TimeUnit.SECONDS);
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Envio interrumpido");
        } catch (ExecutionException | TimeoutException error) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Kafka no confirmo el mensaje");
        }
    }
}
