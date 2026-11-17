package cl.puntogamer.streaming.events;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;

/** Evento del topic de resumen (compactado): ultimo estado agregado de la analitica. */
public record ResumenAnaliticaEvent(
        @PositiveOrZero long ventas,
        @PositiveOrZero double ingresos,
        @PositiveOrZero double ticketPromedio,
        @PositiveOrZero double ventaMayor,
        @PositiveOrZero long unidadesVendidas,
        @PositiveOrZero int productosDistintos,
        @PositiveOrZero long eventosDePrueba,
        @PositiveOrZero long mensajesEnDlt,
        String ultimoEvento,
        @NotBlank String generadoEn) {
}
