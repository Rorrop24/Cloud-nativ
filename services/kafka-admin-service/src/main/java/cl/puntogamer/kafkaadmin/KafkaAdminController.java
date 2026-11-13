package cl.puntogamer.kafkaadmin;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Sin @Validated a nivel de clase: Spring MVC valida los parametros y responde 400
 * (HandlerMethodValidationException) en lugar de un error 500 del proxy AOP.
 */
@RestController
public class KafkaAdminController {
    private final KafkaClusterService service;

    public KafkaAdminController(KafkaClusterService service) {
        this.service = service;
    }

    /** Publico para el healthcheck de Docker y Nginx; no expone nombres ni direcciones. */
    @GetMapping("/health")
    public Map<String, Object> health() {
        int brokers = service.brokerCount();
        Map<String, Object> health = new LinkedHashMap<>();
        health.put("status", "UP");
        health.put("service", "kafka-admin-service");
        health.put("brokers", brokers);
        health.put("kafka", brokers > 0 ? "CONNECTED" : "UNAVAILABLE");
        return health;
    }

    @GetMapping("/api/kafka/cluster")
    public Map<String, Object> cluster() {
        return service.cluster();
    }

    @GetMapping("/api/kafka/topics")
    public List<Map<String, Object>> topics() {
        return service.topics();
    }

    @GetMapping("/api/kafka/topics/{name}")
    public Map<String, Object> topic(@PathVariable @Pattern(regexp = Requests.TOPIC_NAME) String name) {
        return service.topic(name);
    }

    @PostMapping("/api/kafka/topics")
    public ResponseEntity<?> createTopic(@Valid @RequestBody Requests.TopicRequest request) {
        service.createTopic(request);
        return ResponseEntity.status(201).body(Map.of("name", request.name(),
                "partitions", request.partitionCount(), "replicationFactor", request.replicas()));
    }

    @DeleteMapping("/api/kafka/topics/{name}")
    public ResponseEntity<?> deleteTopic(@PathVariable @Pattern(regexp = Requests.TOPIC_NAME) String name) {
        service.deleteTopic(name);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/kafka/topics/{name}/messages")
    public List<Map<String, Object>> messages(@PathVariable @Pattern(regexp = Requests.TOPIC_NAME) String name,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit) {
        return service.messages(name, limit);
    }

    @GetMapping("/api/kafka/consumer-groups")
    public List<Map<String, Object>> consumerGroups() {
        return service.consumerGroups();
    }

    @PostMapping("/api/kafka/events")
    public Map<String, Object> event(@Valid @RequestBody Requests.EventRequest request) {
        return service.publish(request);
    }
}
