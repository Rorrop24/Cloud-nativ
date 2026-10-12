package cl.tiendalevelup.dto;

import cl.tiendalevelup.Entity.Resenia;
import java.time.LocalDateTime;

public record ReseniaResponse(Long id, String nombre, int rating, String texto, LocalDateTime fecha) {
    public static ReseniaResponse from(Resenia review) {
        return new ReseniaResponse(review.getId(),
                review.getUsuario() == null ? "Cliente" : review.getUsuario().getNombre(),
                review.getCalificacion(), review.getTexto(), review.getFecha());
    }
}
