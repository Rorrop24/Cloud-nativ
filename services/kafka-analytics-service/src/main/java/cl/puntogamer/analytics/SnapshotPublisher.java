package cl.puntogamer.analytics;

import cl.puntogamer.streaming.StreamPublisher;
import cl.puntogamer.streaming.StreamingProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Publica el ResumenAnaliticaEvent en su topic compactado cuando hubo cambios.
 * Siempre con la clave "resumen": la compactacion conserva solo el ultimo.
 */
@Component
public class SnapshotPublisher {
    private static final Logger log = LoggerFactory.getLogger(SnapshotPublisher.class);
    private final AnalyticsState state;
    private final StreamPublisher publisher;
    private final StreamingProperties properties;
    private long published;

    public SnapshotPublisher(AnalyticsState state, StreamPublisher publisher, StreamingProperties properties) {
        this.state = state;
        this.publisher = publisher;
        this.properties = properties;
    }

    @Scheduled(initialDelayString = "${app.analytics.snapshot-interval-ms:30000}",
            fixedDelayString = "${app.analytics.snapshot-interval-ms:30000}")
    public void publish() {
        long version = state.version();
        if (version == published) {
            return;
        }
        try {
            publisher.publish(properties.topics().resumen(), "resumen", state.snapshot());
            published = version;
        } catch (RuntimeException error) {
            log.warn("[KAFKA PRODUCER ERROR] no se publico el resumen: {}", error.toString());
        }
    }
}
