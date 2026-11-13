package cl.puntogamer.analytics;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import cl.puntogamer.streaming.StreamingProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class AnalyticsStateTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final AnalyticsState state = new AnalyticsState(5);
    private final StreamingProperties properties = new StreamingProperties("localhost:9092", 3, 3,
            new StreamingProperties.Topics("ventas.eventos", "ventas.items", "ventas.eventos.DLT",
                    "ventas.items.DLT", "analitica.resumen", "pruebas.eventos"));
    private final SalesStreamConsumer consumer = new SalesStreamConsumer(state, mapper, properties);

    @Test
    void aggregatesSalesAndIgnoresTestEventsInRevenue() throws Exception {
        state.sale(mapper.readTree("{\"boletaId\":1,\"total\":1000.5,\"unidades\":2}"));
        state.sale(mapper.readTree("{\"boletaId\":2,\"total\":499.5,\"unidades\":1}"));
        state.sale(mapper.readTree("{\"boletaId\":-5,\"total\":0,\"prueba\":true}"));
        assertEquals(2L, state.summary().get("ventas"));
        assertEquals(1500.0, state.summary().get("ingresos"));
        assertEquals(750.0, state.summary().get("ticketPromedio"));
        assertEquals(1L, state.summary().get("eventosDePrueba"));
    }

    @Test
    void ranksProductsByUnitsAndFlagsLowStock() throws Exception {
        state.item(mapper.readTree("{\"productoId\":\"A\",\"cantidad\":1,\"stockRestante\":40}"));
        state.item(mapper.readTree("{\"productoId\":\"B\",\"cantidad\":4,\"stockRestante\":2}"));
        state.item(mapper.readTree("{\"productoId\":\"A\",\"cantidad\":2,\"stockRestante\":38}"));
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
    void invalidMessagesAreRejectedSoTheyReachTheDeadLetterTopic() {
        assertThrows(IllegalArgumentException.class, () -> consumer.parse("MENSAJE-INVALIDO", "boletaId"));
        assertThrows(IllegalArgumentException.class, () -> consumer.parse("{\"total\":10}", "boletaId", "total"));
        assertThrows(IllegalArgumentException.class, () -> consumer.parse(null, "boletaId"));
        assertEquals("ventas.eventos.DLT", consumer.deadLetterTopic("ventas.eventos"));
    }
}
