package cl.puntogamer.streaming;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import cl.puntogamer.streaming.events.ProductoVendidoEvent;
import cl.puntogamer.streaming.events.VentaRegistradaEvent;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Properties;
import org.junit.jupiter.api.Test;

class StreamingPropertiesTest {
    private final StreamingProperties.Topics topics = new StreamingProperties.Topics(
            "ventas.eventos", "ventas.items", "ventas.eventos.DLT", "ventas.items.DLT",
            "analitica.resumen", "pruebas.eventos");

    private StreamingProperties properties(Map<String, Long> retention, Map<String, String> cleanup) {
        return new StreamingProperties("localhost:9092", 3, 3, 2, topics, retention, cleanup);
    }

    private static Properties defaults() throws IOException {
        Properties defaults = new Properties();
        try (InputStream stream = StreamingPropertiesTest.class.getResourceAsStream("/kafka-defaults.properties")) {
            defaults.load(stream);
        }
        return defaults;
    }

    @Test
    void projectDeclaresSixDistinctTopics() {
        assertEquals(6, new HashSet<>(topics.all()).size());
    }

    @Test
    void everyBusinessTopicHasItsDeadLetterTopic() {
        assertEquals("ventas.eventos.DLT", topics.deadLetterFor("ventas.eventos"));
        assertEquals("ventas.items.DLT", topics.deadLetterFor("ventas.items"));
        assertTrue(topics.isDeadLetter("ventas.items.DLT"));
        assertFalse(topics.isDeadLetter("ventas.items"));
    }

    @Test
    void defaultsFileConfiguresRetentionAndCleanupForEveryTopic() throws IOException {
        Properties defaults = defaults();
        Map<String, Long> retention = new HashMap<>();
        Map<String, String> cleanup = new HashMap<>();
        for (String key : topics.byKey().keySet()) {
            assertEquals(topics.byKey().get(key), defaults.getProperty("app.kafka.topics." + key), key);
            retention.put(key, Long.valueOf(defaults.getProperty("app.kafka.retention." + key)));
            cleanup.put(key, defaults.getProperty("app.kafka.cleanup." + key));
        }
        Map<String, Map<String, String>> configs = properties(retention, cleanup).topicConfigs();
        assertEquals(6, configs.size());
        assertEquals("compact", configs.get("analitica.resumen").get("cleanup.policy"));
        assertEquals("1209600000", configs.get("ventas.eventos.DLT").get("retention.ms"));
        assertEquals("2", configs.get("ventas.eventos").get("min.insync.replicas"));
    }

    @Test
    void missingRetentionIsRejected() {
        StreamingProperties incomplete = properties(Map.of("ventas", 1000L), Map.of("ventas", "delete"));
        assertThrows(IllegalStateException.class, incomplete::topicConfigs);
    }

    @Test
    void serializerWritesDtoAsJsonAndKeepsRawText() {
        EventJsonSerializer serializer = new EventJsonSerializer();
        String json = new String(serializer.serialize("ventas.eventos",
                VentaRegistradaEvent.of(10L, 2500.0, 1, 2, false, Instant.parse("2026-11-13T00:00:00Z"))),
                StandardCharsets.UTF_8);
        assertTrue(json.contains("\"boletaId\":10"));
        assertTrue(json.contains("\"tipo\":\"VENTA_REGISTRADA\""));
        assertEquals("texto", new String(serializer.serialize("t", "texto"), StandardCharsets.UTF_8));
        ProductoVendidoEvent item = ProductoVendidoEvent.of(10L, "P1", 2, 5, false, Instant.now());
        assertNotNull(serializer.serialize("ventas.items", item));
    }
}
