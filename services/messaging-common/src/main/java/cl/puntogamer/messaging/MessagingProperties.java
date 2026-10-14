package cl.puntogamer.messaging;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;
@Validated
@ConfigurationProperties(prefix="app.messaging")
public record MessagingProperties(@NotBlank String exchange, @NotBlank String deadLetterExchange,
        @NotNull @Valid Route pedidos, @NotNull @Valid Route inventario, @NotNull @Valid Route notificaciones,
        @Min(1) int dlqTtl, @Min(0) @Max(10) int maxRetries) {
    public record Route(@NotBlank String queue, @NotBlank String routingKey,
                        @NotBlank String dlq, @NotBlank String deadLetterRoutingKey, @Min(1) int ttl) {}
    public Route route(String domain) {
        return switch(domain) { case "pedidos" -> pedidos; case "inventario" -> inventario;
            case "notificaciones" -> notificaciones; default -> throw new IllegalArgumentException("Dominio desconocido"); };
    }
}
