package cl.puntogamer.analytics;

import cl.puntogamer.streaming.events.ProductoVendidoEvent;
import cl.puntogamer.streaming.events.ResumenAnaliticaEvent;
import cl.puntogamer.streaming.events.VentaRegistradaEvent;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Logica de negocio de la analitica, sin dependencias de Kafka: recibe DTO ya
 * validados y mantiene los agregados en memoria. Al arrancar, los consumidores
 * releen los topics y este estado se reconstruye. El offset mas alto aplicado por
 * particion evita contar dos veces un evento tras un rebalanceo.
 */
@Component
public class AnalyticsState {
    private static final int RECENT = 50;
    private final int lowStockThreshold;
    private final Map<String, Long> applied = new HashMap<>();
    private final Map<String, ProductTotals> products = new HashMap<>();
    private final Deque<Map<String, Object>> recentSales = new ArrayDeque<>();
    private final Deque<Map<String, Object>> deadLetters = new ArrayDeque<>();
    private long sales;
    private long testEvents;
    private long units;
    private double revenue;
    private double largestSale;
    private long deadLetterCount;
    private String lastEventAt;
    private long version;

    public AnalyticsState(@Value("${app.analytics.low-stock-threshold:5}") int lowStockThreshold) {
        this.lowStockThreshold = lowStockThreshold;
    }

    private static final class ProductTotals {
        long units;
        long orders;
        Integer stock;
    }

    /** true si el registro es nuevo; false si ya se habia aplicado (relectura). */
    public synchronized boolean firstTime(String topic, int partition, long offset) {
        String key = topic + "-" + partition;
        Long last = applied.get(key);
        if (last != null && offset <= last) {
            return false;
        }
        applied.put(key, offset);
        return true;
    }

    public synchronized void registrarVenta(VentaRegistradaEvent event) {
        version++;
        lastEventAt = event.ocurridoEn();
        if (event.prueba()) {
            testEvents++;
            return;
        }
        double total = event.total();
        sales++;
        revenue += total;
        largestSale = Math.max(largestSale, total);
        Map<String, Object> sale = new LinkedHashMap<>();
        sale.put("boletaId", event.boletaId());
        sale.put("total", total);
        sale.put("unidades", event.unidades());
        sale.put("ocurridoEn", event.ocurridoEn());
        recentSales.addFirst(sale);
        while (recentSales.size() > RECENT) {
            recentSales.removeLast();
        }
    }

    public synchronized void registrarProducto(ProductoVendidoEvent event) {
        version++;
        if (event.prueba()) {
            return;
        }
        ProductTotals totals = products.computeIfAbsent(event.productoId(), id -> new ProductTotals());
        totals.units += event.cantidad();
        totals.orders++;
        if (event.stockRestante() != null) {
            totals.stock = event.stockRestante();
        }
        units += event.cantidad();
    }

    public synchronized void registrarDlt(String topic, int partition, long offset, String value, String reason) {
        version++;
        deadLetterCount++;
        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("topic", topic);
        entry.put("partition", partition);
        entry.put("offset", offset);
        entry.put("value", value == null ? null : value.length() > 300 ? value.substring(0, 300) + "..." : value);
        entry.put("reason", reason);
        deadLetters.addFirst(entry);
        while (deadLetters.size() > RECENT) {
            deadLetters.removeLast();
        }
    }

    public synchronized long version() {
        return version;
    }

    /** DTO que se publica en el topic de resumen. */
    public synchronized ResumenAnaliticaEvent snapshot() {
        return new ResumenAnaliticaEvent(sales, round(revenue), sales == 0 ? 0 : round(revenue / sales),
                largestSale, units, products.size(), testEvents, deadLetterCount, lastEventAt, Instant.now().toString());
    }

    public synchronized Map<String, Object> summary() {
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("ventas", sales);
        summary.put("ingresos", round(revenue));
        summary.put("ticketPromedio", sales == 0 ? 0 : round(revenue / sales));
        summary.put("ventaMayor", largestSale);
        summary.put("unidadesVendidas", units);
        summary.put("productosDistintos", products.size());
        summary.put("eventosDePrueba", testEvents);
        summary.put("mensajesEnDlt", deadLetterCount);
        summary.put("ultimoEvento", lastEventAt);
        return summary;
    }

    public synchronized List<Map<String, Object>> topProducts(int limit) {
        return products.entrySet().stream()
                .sorted(Comparator.comparingLong((Map.Entry<String, ProductTotals> entry) -> entry.getValue().units).reversed())
                .limit(limit).map(AnalyticsState::product).toList();
    }

    public synchronized List<Map<String, Object>> lowStock() {
        return products.entrySet().stream()
                .filter(entry -> entry.getValue().stock != null && entry.getValue().stock <= lowStockThreshold)
                .sorted(Comparator.comparingInt((Map.Entry<String, ProductTotals> entry) -> entry.getValue().stock))
                .map(AnalyticsState::product).toList();
    }

    public synchronized List<Map<String, Object>> recentSales() {
        return new ArrayList<>(recentSales);
    }

    public synchronized List<Map<String, Object>> deadLetters() {
        return new ArrayList<>(deadLetters);
    }

    private static double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private static Map<String, Object> product(Map.Entry<String, ProductTotals> entry) {
        Map<String, Object> product = new LinkedHashMap<>();
        product.put("productoId", entry.getKey());
        product.put("unidades", entry.getValue().units);
        product.put("compras", entry.getValue().orders);
        product.put("stockRestante", entry.getValue().stock);
        return product;
    }
}
