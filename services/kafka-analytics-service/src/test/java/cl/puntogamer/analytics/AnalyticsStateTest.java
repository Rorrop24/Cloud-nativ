package cl.puntogamer.analytics;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import cl.puntogamer.streaming.StreamingProperties;
import cl.puntogamer.streaming.events.ProductoVendidoEvent;
import cl.puntogamer.streaming.events.VentaRegistradaEvent;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Validation;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.Test;

class AnalyticsStateTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final AnalyticsState state = new AnalyticsState(5);
    private final StreamingProperties properties = new StreamingProperties("localhost:9092", 3, 3, 2,
            new StreamingProperties.Topics("ventas.eventos", "ventas.items", "ventas.eventos.DLT",
                    "ventas.items.DLT", "analitica.resumen", "pruebas.eventos"),
            Map.of("ventas", 1L), Map.of("ventas", "delete"));
    private final SalesStreamConsumer consumer = new SalesStreamConsumer(state, mapper,
            Validation.buildDefaultValidatorFactory().getValidator(), properties);
    private final Instant now = Instant.parse("2026-11-13T12:00:00Z");

    @Test
    void aggregatesSalesAndIgnoresTestEventsInRevenue() {
        state.registrarVenta(VentaRegistradaEvent.of(1L, 1000.5, 1, 2, false, now));
        state.registrarVenta(VentaRegistradaEvent.of(2L, 499.5, 1, 1, false, now));
        state.registrarVenta(VentaRegistradaEvent.of(-5L, 0, 1, 1, true, now));
        assertEquals(2L, state.summary().get("ventas"));
        assertEquals(1500.0, state.summary().get("ingresos"));
        assertEquals(750.0, state.summary().get("ticketPromedio"));
        assertEquals(1L, state.summary().get("eventosDePrueba"));
        assertEquals(2L, state.snapshot().ventas());
    }

    @Test
    void ranksProductsByUnitsAndFlagsLowStock() {
        state.registrarProducto(ProductoVendidoEvent.of(1L, "A", 1, 40, false, now));
        state.registrarProducto(ProductoVendidoEvent.of(2L, "B", 4, 2, false, now));
        state.registrarProducto(ProductoVendidoEvent.of(3L, "A", 2, 38, false, now));
        assertEquals("B", state.topProducts(10).get(0).get("productoId"));
        assertEquals(3L, state.topProducts(10).get(1).get("unidades"));
        assertEquals(1, state.lowStock().size());
        assertEquals("B", state.lowStock().get(0).get("productoId"));
    }

    @Test
    void sameOffsetIsAppliedOnlyOnce() {
        assertTrue(state.firstTime("ventas.eventos", 0, 7));
        assertFalse(state.firstTime("ventas.eventos", 0, 7));
        assertFalse(state.firstTime("ventas.eventos", 0, 3));
        assertTrue(state.firstTime("ventas.eventos", 1, 3));
    }

    @Test
    void validJsonBecomesTypedEvent() throws Exception {
        String json = mapper.writeValueAsString(VentaRegistradaEvent.of(9L, 100.0, 1, 1, false, now));
        VentaRegistradaEvent event = consumer.parse(json, VentaRegistradaEvent.class);
        assertEquals(9L, event.boletaId());
        assertEquals(100.0, event.total());
    }

    @Test
    void invalidMessagesAreRejectedSoTheyReachTheDeadLetterTopic() {
        assertThrows(IllegalArgumentException.class, () -> consumer.parse("MENSAJE-INVALIDO", VentaRegistradaEvent.class));
        assertThrows(IllegalArgumentException.class, () -> consumer.parse(null, VentaRegistradaEvent.class));
        // JSON valido pero sin boletaId: lo rechaza Bean Validation.
        assertThrows(IllegalArgumentException.class, () -> consumer.parse(
                "{\"eventId\":\"x\",\"tipo\":\"VENTA_REGISTRADA\",\"total\":10,\"ocurridoEn\":\"2026-11-13T00:00:00Z\"}",
                VentaRegistradaEvent.class));
        // Cantidad 0: un producto vendido debe tener cantidad positiva.
        assertThrows(IllegalArgumentException.class, () -> consumer.parse(
                "{\"eventId\":\"x\",\"tipo\":\"PRODUCTO_VENDIDO\",\"boletaId\":1,\"productoId\":\"A\",\"cantidad\":0,\"ocurridoEn\":\"t\"}",
                ProductoVendidoEvent.class));
        assertEquals("ventas.eventos.DLT", consumer.deadLetterTopic("ventas.eventos"));
    }
}
