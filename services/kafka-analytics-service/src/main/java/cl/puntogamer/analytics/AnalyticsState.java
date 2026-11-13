package cl.puntogamer.analytics;

import com.fasterxml.jackson.databind.JsonNode;
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
 * Agregados en memoria. No usa base de datos: al arrancar, los consumidores releen
 * los topics desde el inicio y este estado se reconstruye solo. El offset mas alto
 * aplicado por particion evita contar dos veces un evento tras un rebalanceo.
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

    public synchronized void sale(JsonNode event) {
        version++;
        lastEventAt = event.path("ocurridoEn").asText(Instant.now().toString());
        if (event.path("prueba").asBoolean(false)) {
            testEvents++;
            return;
        }
        double total = event.path("total").asDouble(0);
        sales++;
        revenue += total;
        largestSale = Math.max(largestSale, total);
        Map<String, Object> sale = new LinkedHashMap<>();
        sale.put("boletaId", event.path("boletaId").asLong());
        sale.put("total", total);
        sale.put("unidades", event.path("unidades").asInt(0));
        sale.put("ocurridoEn", lastEventAt);
        recentSales.addFirst(sale);
        while (recentSales.size() > RECENT) {
            recentSales.removeLast();
        }
    }

    public synchronized void item(JsonNode event) {
        version++;
        if (event.path("prueba").asBoolean(false)) {
            return;
        }
        int quantity = event.path("cantidad").asInt(0);
        ProductTotals totals = products.computeIfAbsent(event.path("productoId").asText(), id -> new ProductTotals());
        totals.units += quantity;
        totals.orders++;
        if (event.hasNonNull("stockRestante")) {
            totals.stock = event.path("stockRestante").asInt();
        }
        units += quantity;
    }

    public synchronized void deadLetter(String topic, int partition, long offset, String value, String reason) {
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

    public synchronized Map<String, Object> summary() {
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("ventas", sales);
        summary.put("ingresos", Math.round(revenue * 100.0) / 100.0);
        summary.put("ticketPromedio", sales == 0 ? 0 : Math.round(revenue / sales * 100.0) / 100.0);
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

    private static Map<String, Object> product(Map.Entry<String, ProductTotals> entry) {
        Map<String, Object> product = new LinkedHashMap<>();
        product.put("productoId", entry.getKey());
        product.put("unidades", entry.getValue().units);
        product.put("compras", entry.getValue().orders);
        product.put("stockRestante", entry.getValue().stock);
        return product;
    }
}
