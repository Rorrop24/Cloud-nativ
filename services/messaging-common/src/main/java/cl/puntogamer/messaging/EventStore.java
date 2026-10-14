package cl.puntogamer.messaging;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;
public class EventStore {
    private final JdbcTemplate jdbc;
    private final TransactionTemplate transaction;
    public EventStore(JdbcTemplate jdbc, TransactionTemplate transaction) { this.jdbc=jdbc; this.transaction=transaction; }
    public void process(String domain, String id, String reference, Runnable action) {
        try {
            transaction.executeWithoutResult(status -> {
                if (exists(domain,id)) return;
                jdbc.update("INSERT INTO event_receipts(domain,event_id,reference_id,processed_at) VALUES (?,?,?,CURRENT_TIMESTAMP)", domain,id,reference);
                action.run();
            });
        } catch (DuplicateKeyException race) { if (!exists(domain,id)) throw race; }
    }
    private boolean exists(String domain,String id) { return jdbc.queryForObject("SELECT COUNT(*) FROM event_receipts WHERE domain=? AND event_id=?",Integer.class,domain,id)>0; }
}
