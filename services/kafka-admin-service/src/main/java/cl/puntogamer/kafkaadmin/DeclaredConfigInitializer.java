package cl.puntogamer.kafkaadmin;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.stereotype.Component;

/**
 * Al arrancar, aplica a los topics del proyecto la retencion y limpieza declaradas.
 * Los topics pueden haberse creado antes (cloud-init) sin esa configuracion. Si
 * Kafka aun no responde, reintenta en segundo plano sin bloquear el servicio.
 */
@Component
public class DeclaredConfigInitializer implements ApplicationListener<ApplicationReadyEvent> {
    private static final Logger log = LoggerFactory.getLogger(DeclaredConfigInitializer.class);
    private static final int ATTEMPTS = 20;
    private final KafkaClusterService service;

    public DeclaredConfigInitializer(KafkaClusterService service) {
        this.service = service;
    }

    @Override
    public void onApplicationEvent(ApplicationReadyEvent event) {
        Thread worker = new Thread(this::apply, "kafka-declared-config");
        worker.setDaemon(true);
        worker.start();
    }

    private void apply() {
        for (int attempt = 1; attempt <= ATTEMPTS; attempt++) {
            try {
                log.info("[KAFKA ADMIN] configuracion declarada: {}", service.applyDeclaredConfigs());
                return;
            } catch (RuntimeException error) {
                log.warn("[KAFKA ADMIN] intento {}/{} de aplicar la configuracion declarada fallo: {}", attempt,
                        ATTEMPTS, error.getMessage());
            }
            try {
                Thread.sleep(15000);
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                return;
            }
        }
    }
}
