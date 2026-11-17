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
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * API de administracion de Kafka. Todo salvo /health exige el rol Rabbit.Admin
 * (StreamSecurityConfiguration). Sin @Validated a nivel de clase: Spring MVC valida
 * los parametros y responde 400 en lugar de un error 500 del proxy AOP.
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

    // ---- topics

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
        return ResponseEntity.status(201).body(Map.of("name", request.name(), "partitions", request.partitionCount(),
                "replicationFactor", request.replicas(), "config", request.configs()));
    }

    @DeleteMapping("/api/kafka/topics/{name}")
    public ResponseEntity<?> deleteTopic(@PathVariable @Pattern(regexp = Requests.TOPIC_NAME) String name) {
        service.deleteTopic(name);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/kafka/topics/{name}/config")
    public Map<String, Object> topicConfig(@PathVariable @Pattern(regexp = Requests.TOPIC_NAME) String name) {
        return service.topicConfig(name);
    }

    @PutMapping("/api/kafka/topics/{name}/config")
    public Map<String, Object> updateTopicConfig(@PathVariable @Pattern(regexp = Requests.TOPIC_NAME) String name,
            @Valid @RequestBody Requests.TopicConfigRequest request) {
        return service.updateTopicConfig(name, request.validated());
    }

    @DeleteMapping("/api/kafka/topics/{name}/config/{key}")
    public Map<String, Object> resetTopicConfig(@PathVariable @Pattern(regexp = Requests.TOPIC_NAME) String name,
            @PathVariable @Pattern(regexp = "[a-z.]{1,40}") String key) {
        if (!Requests.EDITABLE_CONFIGS.contains(key)) {
            throw new IllegalArgumentException("Propiedad no editable: " + key);
        }
        return service.resetTopicConfig(name, key);
    }

    @PostMapping("/api/kafka/topics/{name}/partitions")
    public Map<String, Object> increasePartitions(@PathVariable @Pattern(regexp = Requests.TOPIC_NAME) String name,
            @Valid @RequestBody Requests.PartitionsRequest request) {
        return service.increasePartitions(name, request.count());
    }

    /** Reaplica la configuracion declarada en kafka-defaults.properties a los seis topics. */
    @PostMapping("/api/kafka/topics/sync-config")
    public List<Map<String, Object>> syncConfig() {
        return service.applyDeclaredConfigs();
    }

    @GetMapping("/api/kafka/topics/{name}/messages")
    public List<Map<String, Object>> messages(@PathVariable @Pattern(regexp = Requests.TOPIC_NAME) String name,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit) {
        return service.messages(name, limit);
    }

    // ---- consumer groups

    @GetMapping("/api/kafka/consumer-groups")
    public List<Map<String, Object>> consumerGroups() {
        return service.consumerGroups();
    }

    @GetMapping("/api/kafka/consumer-groups/{id}")
    public Map<String, Object> consumerGroup(@PathVariable @Pattern(regexp = Requests.GROUP_ID) String id) {
        return service.consumerGroup(id);
    }

    @PostMapping("/api/kafka/consumer-groups/{id}/offsets")
    public Map<String, Object> resetOffsets(@PathVariable @Pattern(regexp = Requests.GROUP_ID) String id,
            @Valid @RequestBody Requests.OffsetResetRequest request) {
        return service.resetGroupOffsets(id, request.to());
    }

    // ---- eventos de prueba

    @PostMapping("/api/kafka/events")
    public Map<String, Object> event(@Valid @RequestBody Requests.EventRequest request) {
        return service.publish(request);
    }
}
