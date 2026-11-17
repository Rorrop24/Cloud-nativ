package cl.puntogamer.streaming.events;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

/** Evento del topic de items: un producto dentro de una compra. Clave = productoId. */
public record ProductoVendidoEvent(
        @NotBlank String eventId,
        @NotBlank @Pattern(regexp = "PRODUCTO_VENDIDO") String tipo,
        @NotNull Long boletaId,
        @NotBlank @Size(max = 100) String productoId,
        @Positive int cantidad,
        @PositiveOrZero Integer stockRestante,
        boolean prueba,
        @NotBlank String ocurridoEn) {

    public static final String TIPO = "PRODUCTO_VENDIDO";

    public static ProductoVendidoEvent of(Long boletaId, String productoId, int cantidad, Integer stockRestante,
            boolean prueba, Instant ocurridoEn) {
        return new ProductoVendidoEvent(UUID.randomUUID().toString(), TIPO, boletaId, productoId, cantidad,
                stockRestante, prueba, ocurridoEn.toString());
    }
}
