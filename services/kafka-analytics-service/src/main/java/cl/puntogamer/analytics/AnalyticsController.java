package cl.puntogamer.analytics;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AnalyticsController {
    private final AnalyticsState state;

    public AnalyticsController(AnalyticsState state) {
        this.state = state;
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "UP", "service", "kafka-analytics-service");
    }

    @GetMapping("/api/analytics/resumen")
    public Map<String, Object> summary() {
        return state.summary();
    }

    @GetMapping("/api/analytics/productos")
    public List<Map<String, Object>> products(@RequestParam(defaultValue = "10") @Min(1) @Max(50) int limit) {
        return state.topProducts(limit);
    }

    @GetMapping("/api/analytics/stock-bajo")
    public List<Map<String, Object>> lowStock() {
        return state.lowStock();
    }

    @GetMapping("/api/analytics/ventas")
    public List<Map<String, Object>> sales() {
        return state.recentSales();
    }

    @GetMapping("/api/analytics/dlt")
    public List<Map<String, Object>> deadLetters() {
        return state.deadLetters();
    }

    /** Todo en una sola respuesta para el panel de administracion. */
    @GetMapping("/api/analytics/panel")
    public Map<String, Object> panel() {
        Map<String, Object> panel = new LinkedHashMap<>();
        panel.put("resumen", state.summary());
        panel.put("productos", state.topProducts(10));
        panel.put("stockBajo", state.lowStock());
        panel.put("ventasRecientes", state.recentSales());
        panel.put("dlt", state.deadLetters());
        return panel;
    }
}
