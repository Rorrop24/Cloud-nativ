package cl.puntogamer.streaming.events;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import java.time.Instant;
import java.util.UUID;

/** Evento del topic de ventas: una compra confirmada. Clave = boletaId. */
public record VentaRegistradaEvent(
        @NotBlank String eventId,
        @NotBlank @Pattern(regexp = "VENTA_REGISTRADA") String tipo,
        @NotNull Long boletaId,
        @NotNull @PositiveOrZero Double total,
        @PositiveOrZero int lineas,
        @PositiveOrZero int unidades,
        boolean prueba,
        @NotBlank String ocurridoEn) {

    public static final String TIPO = "VENTA_REGISTRADA";

    public static VentaRegistradaEvent of(Long boletaId, double total, int lineas, int unidades,
            boolean prueba, Instant ocurridoEn) {
        return new VentaRegistradaEvent(UUID.randomUUID().toString(), TIPO, boletaId, total, lineas, unidades,
                prueba, ocurridoEn.toString());
    }
}
