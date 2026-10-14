package cl.puntogamer.messaging;
import com.fasterxml.jackson.databind.*;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import org.slf4j.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;
public class Outbox {
    private static final Logger log = LoggerFactory.getLogger(Outbox.class);
    private final ObjectMapper mapper = new ObjectMapper();
    private final JdbcTemplate jdbc;
    private final TransactionTemplate transaction;
    private final ConfirmedPublisher publisher;
    private final String producer;
    public Outbox(JdbcTemplate jdbc,TransactionTemplate transaction,ConfirmedPublisher publisher,String producer) { this.jdbc=jdbc; this.transaction=transaction; this.publisher=publisher; this.producer=producer; }
    public String enqueue(String exchange,String key,Map<String,?> payload) {
        String id=UUID.randomUUID().toString();
        try {
            jdbc.update("INSERT INTO messaging_outbox(event_id,producer,exchange_name,routing_key,payload,attempts,created_at,available_at) VALUES (?,?,?,?,?,0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)", id,producer,exchange,key,mapper.writeValueAsString(payload));
        } catch(java.io.IOException e) { throw new IllegalArgumentException("Evento no serializable",e); }
        log.info("[PRODUCER QUEUED] eventId={} exchange={} key={} persistido en outbox",id,exchange,key);
        return id;
    }
    public boolean dispatchOne() {
        return Boolean.TRUE.equals(transaction.execute(status -> {
            var rows=jdbc.queryForList("SELECT event_id,exchange_name,routing_key,payload,attempts FROM messaging_outbox WHERE producer=? AND delivered_at IS NULL AND available_at<=CURRENT_TIMESTAMP ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED",producer);
            if(rows.isEmpty()) return false;
            var row=rows.get(0); String id=(String)row.get("event_id");
            try {
                publisher.send((String)row.get("exchange_name"),(String)row.get("routing_key"),mapper.readTree((String)row.get("payload")),id);
                jdbc.update("UPDATE messaging_outbox SET delivered_at=CURRENT_TIMESTAMP,last_error=NULL WHERE event_id=?",id);
                log.info("[PRODUCER CONFIRMED] eventId={} brokerACK=true routed=true",id);
            } catch(Exception failure) {
                int attempts=((Number)row.get("attempts")).intValue()+1;
                String detail=failure.getMessage()==null?failure.getClass().getSimpleName():failure.getMessage();
                jdbc.update("UPDATE messaging_outbox SET attempts=?,available_at=?,last_error=? WHERE event_id=?",attempts,Timestamp.from(Instant.now().plusSeconds(Math.min(60,5L*attempts))),detail.substring(0,Math.min(1000,detail.length())),id);
                log.error("[PRODUCER PENDING] eventId={} attempt={} conservado para reintento",id,attempts,failure);
            }
            return true;
        }));
    }
}
