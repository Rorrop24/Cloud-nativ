package cl.puntogamer.streaming;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashSet;
import java.util.Properties;
import org.junit.jupiter.api.Test;

class StreamingPropertiesTest {
    private final StreamingProperties.Topics topics = new StreamingProperties.Topics(
            "ventas.eventos", "ventas.items", "ventas.eventos.DLT", "ventas.items.DLT",
            "analitica.resumen", "pruebas.eventos");

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
    void defaultsFileDeclaresTheSameSixTopics() throws IOException {
        Properties defaults = new Properties();
        try (InputStream stream = getClass().getResourceAsStream("/kafka-defaults.properties")) {
            defaults.load(stream);
        }
        long declared = defaults.stringPropertyNames().stream()
                .filter(name -> name.startsWith("app.kafka.topics.")).count();
        assertEquals(6, declared);
        assertTrue(topics.all().contains(defaults.getProperty("app.kafka.topics.ventas")));
    }
}
