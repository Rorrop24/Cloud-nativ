package cl.tiendalevelup.streaming;

import cl.puntogamer.streaming.StreamPublisher;
import cl.puntogamer.streaming.StreamingProperties;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Productor de streaming. Por cada compra publica un evento en el topic de ventas
 * (clave = boleta) y uno por producto en el topic de items (clave = producto), de
 * modo que todos los eventos de un mismo producto quedan ordenados en una particion.
 * RabbitMQ sigue siendo el camino transaccional; Kafka alimenta la analitica.
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

    /** Se llama dentro de la transaccion de la compra; envia recien despues del commit. */
    public void publicarVenta(Long boletaId, Object items, Double total) {
        List<Map<String, Object>> lineas = lineas(items);
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

    /** Evento sintetico para demostrar el flujo sin comprar. No suma a los ingresos. */
    public Map<String, Object> publicarPrueba(String productoId, int cantidad) {
        long referencia = -System.currentTimeMillis();
        List<Map<String, Object>> lineas = List.of(Map.of("productoId", productoId, "cantidad", cantidad));
        enviar(referencia, lineas, 0d, true);
        return Map.of("boletaId", referencia, "topics",
                List.of(properties.topics().ventas(), properties.topics().items()), "prueba", true);
    }

    private void enviar(Long boletaId, List<Map<String, Object>> lineas, double total, boolean prueba) {
        // Un fallo de Kafka nunca debe romper una compra ya confirmada en la base de datos.
        try {
            String ocurridoEn = Instant.now().toString();
            int unidades = 0;
            for (Map<String, Object> linea : lineas) {
                unidades += numero(linea.get("cantidad"));
            }
            Map<String, Object> venta = new LinkedHashMap<>();
            venta.put("eventId", UUID.randomUUID().toString());
            venta.put("tipo", "VENTA_REGISTRADA");
            venta.put("boletaId", boletaId);
            venta.put("total", total);
            venta.put("lineas", lineas.size());
            venta.put("unidades", unidades);
            venta.put("prueba", prueba);
            venta.put("ocurridoEn", ocurridoEn);
            publisher.publish(properties.topics().ventas(), String.valueOf(boletaId), venta);
            for (Map<String, Object> linea : lineas) {
                String productoId = String.valueOf(linea.get("productoId"));
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("eventId", UUID.randomUUID().toString());
                item.put("tipo", "PRODUCTO_VENDIDO");
                item.put("boletaId", boletaId);
                item.put("productoId", productoId);
                item.put("cantidad", numero(linea.get("cantidad")));
                if (linea.get("stockAfter") != null) {
                    item.put("stockRestante", numero(linea.get("stockAfter")));
                }
                item.put("prueba", prueba);
                item.put("ocurridoEn", ocurridoEn);
                publisher.publish(properties.topics().items(), productoId, item);
            }
        } catch (RuntimeException error) {
            log.error("[KAFKA PRODUCER ERROR] boletaId={} no se publico en streaming: {}", boletaId, error.toString());
        }
    }

    private static List<Map<String, Object>> lineas(Object items) {
        List<Map<String, Object>> lineas = new ArrayList<>();
        if (items instanceof List<?> lista) {
            for (Object elemento : lista) {
                if (elemento instanceof Map<?, ?> mapa) {
                    Map<String, Object> linea = new LinkedHashMap<>();
                    mapa.forEach((clave, valor) -> linea.put(String.valueOf(clave), valor));
                    lineas.add(linea);
                }
            }
        }
        return lineas;
    }

    private static int numero(Object valor) {
        return valor instanceof Number numero ? numero.intValue() : 0;
    }
}
