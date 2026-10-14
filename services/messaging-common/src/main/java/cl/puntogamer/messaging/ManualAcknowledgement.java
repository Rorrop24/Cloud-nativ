package cl.puntogamer.messaging;
import com.fasterxml.jackson.databind.*;
import com.rabbitmq.client.Channel;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.function.Consumer;
import org.slf4j.*;
import org.springframework.amqp.core.Message;
import org.springframework.dao.TransientDataAccessException;
public class ManualAcknowledgement {
    private static final Logger log = LoggerFactory.getLogger(ManualAcknowledgement.class);
    private final ObjectMapper mapper = new ObjectMapper();
    private final MessagingProperties properties;
    private final ConfirmedPublisher publisher;
    public ManualAcknowledgement(MessagingProperties properties, ConfirmedPublisher publisher) { this.properties=properties; this.publisher=publisher; }
    public String id(Message message) {
        if (message.getMessageProperties().getMessageId() != null) return message.getMessageProperties().getMessageId();
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(message.getBody())); }
        catch(Exception e) { throw new IllegalStateException(e); }
    }
    public void process(String domain, Message message, Channel channel, long tag, Consumer<JsonNode> operation) throws IOException {
        String id = id(message);
        var route = properties.route(domain);
        log.info("[{} RECEIVED] eventId={} queue={}", domain.toUpperCase(), id, route.queue());
        try {
            JsonNode body = mapper.readTree(new String(message.getBody(), StandardCharsets.UTF_8));
            if (body != null && body.isTextual()) body = mapper.readTree(body.textValue());
            if (body == null || !body.isObject()) throw new IllegalArgumentException("El evento debe ser un objeto JSON");
            log.info("[{} EVENT] eventId={} reference={}",domain.toUpperCase(),id,body.path("boletaId").asText(body.path("idPedido").asText()));
            String text = body.path("mensaje").asText();
            if (text.contains("ERROR") || text.contains("PAY-FAIL") || text.contains("PAY-CANCEL") || text.contains("smtp_fail")) throw new IllegalArgumentException("Evento invalido de prueba: " + text);
            if (text.contains("RETRY") && attempt(message) < properties.maxRetries()) throw new TransientDataAccessException("Fallo temporal controlado de prueba") {};
            operation.accept(body);
        } catch (TransientDataAccessException temporary) {
            int next = attempt(message) + 1;
            if (next <= properties.maxRetries()) {
                try {
                    publisher.retry(properties.exchange(), route.routingKey(), message, next, id);
                } catch (Exception retryFailure) {
                    reject(domain, route, id, channel, tag, retryFailure);
                    return;
                }
                // A lost ACK must propagate to container recovery, also on the retry path.
                channel.basicAck(tag, false);
                log.warn("[{} RETRY] eventId={} attempt={} original=ACK", domain.toUpperCase(), id, next);
                return;
            }
            reject(domain, route, id, channel, tag, temporary);
            return;
        } catch (Exception permanent) { reject(domain, route, id, channel, tag, permanent); return; }
        // If ACK itself fails, let the container recover/redeliver. Do not issue a second acknowledgement.
        channel.basicAck(tag, false);
        log.info("[{} SUCCESS] eventId={} queue={} ACK enviado", domain.toUpperCase(), id, route.queue());
    }
    private int attempt(Message message) {
        Object value = message.getMessageProperties().getHeaders().get("x-attempt");
        return value instanceof Number number ? (int)Math.max(0, Math.min(properties.maxRetries(), number.longValue())) : 0;
    }
    private void reject(String domain, MessagingProperties.Route route, String id, Channel channel, long tag, Exception error) throws IOException {
        log.error("[{} ERROR] eventId={} queue={} NACK requeue=false destinoDLQ={}", domain.toUpperCase(), id, route.queue(), route.dlq(), error);
        channel.basicNack(tag, false, false);
    }
}
