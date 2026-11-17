package cl.puntogamer.kafkaadmin;

import cl.puntogamer.streaming.StreamingProperties;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

public final class Requests {
    /** Nombres legales de topic en Kafka, sin los internos que empiezan con guion bajo. */
    public static final String TOPIC_NAME = "(?!_)[a-zA-Z0-9._-]{1,200}";
    public static final String GROUP_ID = "[a-zA-Z0-9._-]{1,200}";

    /** Propiedades de topic que la API permite cambiar. */
    public static final Set<String> EDITABLE_CONFIGS = Set.of("retention.ms", "retention.bytes", "cleanup.policy",
            "min.insync.replicas", "max.message.bytes", "segment.ms", "delete.retention.ms", "min.compaction.lag.ms");

    private Requests() {
    }

    public record TopicRequest(@NotBlank @Pattern(regexp = TOPIC_NAME, message = "Nombre de topic invalido") String name,
            @Min(1) @Max(12) Integer partitions, @Min(1) @Max(3) Integer replicationFactor,
            @Min(60000) @Max(31536000000L) Long retentionMs,
            @Pattern(regexp = "delete|compact|compact,delete", message = "cleanupPolicy invalida") String cleanupPolicy) {
        public int partitionCount() {
            return partitions == null ? 3 : partitions;
        }

        public short replicas() {
            return (short) (replicationFactor == null ? 3 : replicationFactor);
        }

        /** Configuracion inicial: 7 dias y delete si no se indica otra cosa. */
        public Map<String, String> configs() {
            Map<String, String> configs = new LinkedHashMap<>();
            configs.put("retention.ms", String.valueOf(retentionMs == null ? 604800000L : retentionMs));
            configs.put("cleanup.policy", cleanupPolicy == null ? "delete" : cleanupPolicy);
            configs.put("min.insync.replicas", String.valueOf(Math.min(2, replicas())));
            return configs;
        }
    }

    /** Cambios de configuracion de un topic: {"configs": {"retention.ms": "86400000"}}. */
    public record TopicConfigRequest(@NotEmpty @Size(max = 8) Map<String, String> configs) {

        /** Rechaza propiedades no editables o valores fuera de rango antes de llegar a Kafka. */
        public Map<String, String> validated() {
            Map<String, String> result = new LinkedHashMap<>();
            configs.forEach((key, raw) -> {
                if (!EDITABLE_CONFIGS.contains(key)) {
                    throw new IllegalArgumentException("Propiedad no editable: " + key);
                }
                String value = raw == null ? "" : raw.trim();
                switch (key) {
                    case "cleanup.policy" -> {
                        String normalized = value.equals("delete,compact") ? "compact,delete" : value;
                        if (!StreamingProperties.CLEANUP_POLICIES.contains(normalized)) {
                            throw new IllegalArgumentException("cleanup.policy debe ser delete, compact o compact,delete");
                        }
                        value = normalized;
                    }
                    case "retention.ms" -> range(key, value, -1, 31536000000L);
                    case "retention.bytes" -> range(key, value, -1, Long.MAX_VALUE);
                    case "min.insync.replicas" -> range(key, value, 1, 3);
                    case "max.message.bytes" -> range(key, value, 1024, 10485760);
                    case "segment.ms" -> range(key, value, 60000, 31536000000L);
                    default -> range(key, value, 0, 31536000000L);
                }
                result.put(key, value);
            });
            return result;
        }

        private static void range(String key, String value, long min, long max) {
            long number;
            try {
                number = Long.parseLong(value);
            } catch (NumberFormatException error) {
                throw new IllegalArgumentException(key + " debe ser un numero entero");
            }
            if (number < min || number > max || (key.equals("retention.ms") && number >= 0 && number < 60000)) {
                throw new IllegalArgumentException(key + " fuera de rango");
            }
        }
    }

    public record PartitionsRequest(@NotNull @Min(1) @Max(12) Integer count) {
    }

    public record OffsetResetRequest(@NotBlank @Pattern(regexp = "earliest|latest", message = "to debe ser earliest o latest") String to) {
    }

    public record EventRequest(@NotBlank @Pattern(regexp = TOPIC_NAME, message = "Nombre de topic invalido") String topic,
            @Size(max = 200) String key, @NotBlank @Size(max = 4000) String message) {
    }
}
