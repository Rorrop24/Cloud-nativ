package cl.puntogamer.messaging;
import org.slf4j.*;
import org.springframework.scheduling.annotation.Scheduled;
public class OutboxDispatcher {
    private static final Logger log=LoggerFactory.getLogger(OutboxDispatcher.class);
    private final Outbox outbox;
    public OutboxDispatcher(Outbox outbox) { this.outbox=outbox; }
    @Scheduled(fixedDelayString="${app.outbox.poll-ms:2000}")
    public void dispatch() {
        try { for(int i=0;i<20 && outbox.dispatchOne();i++) {} }
        catch(Exception e) { log.error("[OUTBOX ERROR] Se conservaron los eventos pendientes",e); }
    }
}
