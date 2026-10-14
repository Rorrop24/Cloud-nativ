package cl.puntogamer.notifications;

import cl.puntogamer.messaging.*;
import com.rabbitmq.client.Channel;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.*;
import org.springframework.amqp.core.*;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.support.TransactionTemplate;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class NotificationFlowTest {
    JdbcTemplate jdbc; NotificationConsumer consumer; Channel channel;
    @BeforeEach void setup() {
        var source = new JdbcDataSource();
        source.setURL("jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=MySQL;DB_CLOSE_DELAY=-1");
        new ResourceDatabasePopulator(new ClassPathResource("schema.sql")).execute(source);
        jdbc = new JdbcTemplate(source);
        var route = new MessagingProperties.Route("test.main", "test.key", "test.dlq", "test.dead", 30000);
        var properties = new MessagingProperties("test.exchange", "test.dlx", route, route, route, 86400000, 3);
        consumer = new NotificationConsumer(new ManualAcknowledgement(properties, mock(ConfirmedPublisher.class)),
            new EventStore(jdbc, new TransactionTemplate(new DataSourceTransactionManager(source))), jdbc);
        channel = mock(Channel.class);
    }
    private Message event(String body) {
        var properties = new MessageProperties(); properties.setMessageId("event-1"); properties.setDeliveryTag(42);
        return new Message(body.getBytes(StandardCharsets.UTF_8), properties);
    }
    private Jwt owner(String oid) {
        return Jwt.withTokenValue("token").header("alg", "RS256").claim("tid", "tenant").claim("oid", oid).build();
    }
    @Test void createsEscapedDocumentAndAcknowledgesDuplicateWithoutCreatingAnother() throws Exception {
        var message = event("{\"boletaId\":12,\"owner\":\"tenant:alice\",\"total\":100,\"items\":[{\"productoId\":\"<script>alert(1)</script>\",\"cantidad\":1}]}");
        consumer.consume(message, channel); consumer.consume(message, channel);
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM notification_documents", Integer.class));
        var html = jdbc.queryForObject("SELECT content FROM notification_documents", String.class);
        assertTrue(html.contains("&lt;script&gt;")); assertFalse(html.contains("<script>"));
        assertTrue(html.contains("Content-Security-Policy")); verify(channel, times(2)).basicAck(42, false);
    }
    @Test void anotherUserCannotListOrDownloadDocument() throws Exception {
        consumer.consume(event("{\"boletaId\":12,\"owner\":\"tenant:alice\"}"), channel);
        var controller = new NotificationController(jdbc);
        assertEquals(1, controller.list(owner("alice")).size());
        assertTrue(controller.list(owner("bob")).isEmpty());
        assertEquals(404, controller.document(owner("bob"), "event-1").getStatusCode().value());
        assertEquals(200, controller.document(owner("alice"), "event-1").getStatusCode().value());
    }
    @Test void invalidEventIsRejectedWithoutPersistingDocument() throws Exception {
        consumer.consume(event("{\"mensaje\":\"ERROR\"}"), channel);
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM notification_documents", Integer.class));
        verify(channel).basicNack(42, false, false);
    }
}
