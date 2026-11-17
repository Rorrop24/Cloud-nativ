package cl.puntogamer.streaming;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Topics y su configuracion. Los valores viven en kafka-defaults.properties. */
@Validated
@ConfigurationProperties(prefix = "app.kafka")
public record StreamingProperties(@NotBlank String bootstrapServers, @Min(1) @Max(12) int partitions,
        @Min(1) @Max(3) int replicationFactor, @Min(1) @Max(3) int minInsyncReplicas,
        @NotNull @Valid Topics topics, @NotEmpty Map<String, Long> retention, @NotEmpty Map<String, String> cleanup) {

    public static final Set<String> CLEANUP_POLICIES = Set.of("delete", "compact", "compact,delete");

    public record Topics(@NotBlank String ventas, @NotBlank String items, @NotBlank String ventasDlt,
            @NotBlank String itemsDlt, @NotBlank String resumen, @NotBlank String pruebas) {

        /** Clave del archivo de propiedades -> nombre del topic, en orden estable. */
        public Map<String, String> byKey() {
            Map<String, String> topics = new LinkedHashMap<>();
            topics.put("ventas", ventas);
            topics.put("items", items);
            topics.put("ventas-dlt", ventasDlt);
            topics.put("items-dlt", itemsDlt);
            topics.put("resumen", resumen);
            topics.put("pruebas", pruebas);
            return topics;
        }

        /** Los seis topics del proyecto, en orden estable. */
        public List<String> all() {
            return List.copyOf(byKey().values());
        }

        /** Topic de errores asociado a un topic de negocio. */
        public String deadLetterFor(String topic) {
            if (ventas.equals(topic)) {
                return ventasDlt;
            }
            if (items.equals(topic)) {
                return itemsDlt;
            }
            return topic + ".DLT";
        }

        public boolean isDeadLetter(String topic) {
            return ventasDlt.equals(topic) || itemsDlt.equals(topic);
        }
    }

    /**
     * Configuracion declarada de cada topic (nombre -> propiedades Kafka). Se usa al
     * crear los topics y para sincronizar los que ya existen. Falla si un topic no
     * tiene retencion o politica de limpieza.
     */
    public Map<String, Map<String, String>> topicConfigs() {
        if (minInsyncReplicas > replicationFactor) {
            throw new IllegalStateException("min-insync-replicas no puede superar replication-factor");
        }
        Map<String, Map<String, String>> result = new LinkedHashMap<>();
        topics.byKey().forEach((key, name) -> {
            Long retentionMs = retention.get(key);
            String policy = cleanup.get(key);
            if (retentionMs == null || policy == null) {
                throw new IllegalStateException("Falta app.kafka.retention." + key + " o app.kafka.cleanup." + key);
            }
            if (!CLEANUP_POLICIES.contains(policy)) {
                throw new IllegalStateException("cleanup." + key + " debe ser delete, compact o compact,delete");
            }
            Map<String, String> config = new LinkedHashMap<>();
            config.put("retention.ms", String.valueOf(retentionMs));
            config.put("cleanup.policy", policy);
            config.put("min.insync.replicas", String.valueOf(minInsyncReplicas));
            result.put(name, config);
        });
        return result;
    }
}
