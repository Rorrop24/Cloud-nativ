package cl.puntogamer.kafkaadmin;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class Requests {
    /** Nombres legales de topic en Kafka, sin los internos que empiezan con guion bajo. */
    public static final String TOPIC_NAME = "(?!_)[a-zA-Z0-9._-]{1,200}";

    private Requests() {
    }

    public record TopicRequest(@NotBlank @Pattern(regexp = TOPIC_NAME, message = "Nombre de topic invalido") String name,
            @Min(1) @Max(12) Integer partitions, @Min(1) @Max(3) Integer replicationFactor) {
        public int partitionCount() {
            return partitions == null ? 3 : partitions;
        }

        public short replicas() {
            return (short) (replicationFactor == null ? 3 : replicationFactor);
        }
    }

    public record EventRequest(@NotBlank @Pattern(regexp = TOPIC_NAME, message = "Nombre de topic invalido") String topic,
            @Size(max = 200) String key, @NotBlank @Size(max = 4000) String message) {
    }
}
