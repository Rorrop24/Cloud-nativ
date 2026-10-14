package cl.puntogamer.admin;
import jakarta.validation.constraints.*;
public final class Requests {
    private Requests() {}
    public record QueueRequest(@NotBlank @Size(max=255) @Pattern(regexp="(?!amq\\.)[a-zA-Z0-9._-]+",message="Nombre de cola invalido") String queueName,
        Boolean durable,@Pattern(regexp="classic|quorum") String queueType) {
        public boolean isDurable(){return durable==null||durable;}
        public String type(){return queueType==null?"quorum":queueType;}
        @AssertTrue(message="Una cola quorum debe ser durable") public boolean isConfigurationValid(){return !type().equals("quorum")||isDurable();}
    }
    public record ExchangeRequest(@NotBlank @Size(max=255) @Pattern(regexp="[a-zA-Z0-9._-]+") String exchangeName,
        @Pattern(regexp="direct|topic|fanout|headers") String type,Boolean durable) {
        public String exchangeType(){return type==null?"direct":type;}
        public boolean isDurable(){return durable==null||durable;}
    }
    public record BindingRequest(@NotBlank @Size(max=255) @Pattern(regexp="[a-zA-Z0-9._-]+") String queueName,
        @NotBlank @Size(max=255) @Pattern(regexp="[a-zA-Z0-9._-]+") String exchangeName,
        @NotBlank @Size(max=255) String routingKey) {}
    public record EventRequest(@NotBlank @Pattern(regexp="pedidos|inventario|notificaciones") String domain,
        @NotBlank @Size(max=100) String reference,@NotBlank @Size(max=2000) String message) {}
}
