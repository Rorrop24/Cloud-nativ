package cl.tiendalevelup.streaming;

import cl.puntogamer.streaming.StreamPublisher;
import cl.puntogamer.streaming.StreamingProperties;
import cl.puntogamer.streaming.events.ProductoVendidoEvent;
import cl.puntogamer.streaming.events.VentaRegistradaEvent;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Productor de streaming. Por cada compra publica un VentaRegistradaEvent en el
 * topic de ventas (clave = boleta) y un ProductoVendidoEvent por producto en el
 * topic de items (clave = producto), de modo que los eventos de un mismo producto
 * quedan ordenados en una particion. RabbitMQ sigue siendo el camino
 * transaccional; Kafka alimenta la analitica.
 */
@Component
@Profile("streaming")
public class VentaStreamProducer {
    private static final Logger log = LoggerFactory.getLogger(VentaStreamProducer.class);
    private final StreamPublisher publisher;
    private final StreamingProperties properties;

    public VentaStreamProducer(StreamPublisher publisher, StreamingProperties properties) {
        this.publisher = publisher;
        this.properties = properties;
    }

    /** Linea de compra ya validada por BoletaService. */
    record Linea(String productoId, int cantidad, Integer stockRestante) {
    }

    /** Se llama dentro de la transaccion de la compra; envia recien despues del commit. */
    public void publicarVenta(Long boletaId, Object items, Double total) {
        List<Linea> lineas = lineas(items);
        Runnable envio = () -> enviar(boletaId, lineas, total == null ? 0d : total, false);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    envio.run();
                }
            });
        } else {
            envio.run();
        }
    }

    /** Evento de prueba para demostrar el flujo sin comprar. No suma a los ingresos. */
    public Map<String, Object> publicarPrueba(String productoId, int cantidad) {
        long referencia = -System.currentTimeMillis();
        enviar(referencia, List.of(new Linea(productoId, cantidad, null)), 0d, true);
        return Map.of("boletaId", referencia, "topics",
                List.of(properties.topics().ventas(), properties.topics().items()), "prueba", true);
    }

    private void enviar(Long boletaId, List<Linea> lineas, double total, boolean prueba) {
        // Un fallo de Kafka nunca debe romper una compra ya confirmada en la base de datos.
        try {
            Instant ahora = Instant.now();
            int unidades = lineas.stream().mapToInt(Linea::cantidad).sum();
            publisher.publish(properties.topics().ventas(), String.valueOf(boletaId),
                    VentaRegistradaEvent.of(boletaId, total, lineas.size(), unidades, prueba, ahora));
            for (Linea linea : lineas) {
                publisher.publish(properties.topics().items(), linea.productoId(), ProductoVendidoEvent.of(
                        boletaId, linea.productoId(), linea.cantidad(), linea.stockRestante(), prueba, ahora));
            }
        } catch (RuntimeException error) {
            log.error("[KAFKA PRODUCER ERROR] boletaId={} no se publico en streaming: {}", boletaId, error.toString());
        }
    }

    /** Convierte las lineas que arma BoletaService (mapas) en lineas tipadas. */
    private static List<Linea> lineas(Object items) {
        List<Linea> lineas = new ArrayList<>();
        if (items instanceof List<?> lista) {
            for (Object elemento : lista) {
                if (elemento instanceof Map<?, ?> mapa && mapa.get("productoId") != null) {
                    Integer stock = mapa.get("stockAfter") instanceof Number numero ? numero.intValue() : null;
                    lineas.add(new Linea(String.valueOf(mapa.get("productoId")), numero(mapa.get("cantidad")), stock));
                }
            }
        }
        return lineas;
    }

    private static int numero(Object valor) {
        return valor instanceof Number numero ? numero.intValue() : 0;
    }
}
