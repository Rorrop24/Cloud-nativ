package cl.puntogamer.streaming;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Nombres y forma de los topics. Los valores viven en kafka-defaults.properties. */
@Validated
@ConfigurationProperties(prefix = "app.kafka")
public record StreamingProperties(@NotBlank String bootstrapServers, @Min(1) @Max(12) int partitions,
        @Min(1) @Max(3) int replicationFactor, @NotNull @Valid Topics topics) {

    public record Topics(@NotBlank String ventas, @NotBlank String items, @NotBlank String ventasDlt,
            @NotBlank String itemsDlt, @NotBlank String resumen, @NotBlank String pruebas) {

        /** Los seis topics del proyecto, en orden estable. */
        public List<String> all() {
            return List.of(ventas, items, ventasDlt, itemsDlt, resumen, pruebas);
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
}
