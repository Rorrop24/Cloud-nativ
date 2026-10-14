package cl.puntogamer.inventory;

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
import org.springframework.transaction.support.TransactionTemplate;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class InventoryFlowTest {
    JdbcTemplate jdbc; InventoryConsumer consumer; Channel channel;
    @BeforeEach void setup() {
        var source = new JdbcDataSource();
        source.setURL("jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=MySQL;DB_CLOSE_DELAY=-1");
        new ResourceDatabasePopulator(new ClassPathResource("schema.sql")).execute(source);
        jdbc = new JdbcTemplate(source); jdbc.execute("CREATE TABLE productos(id VARCHAR(255) PRIMARY KEY,stock INT)");
        jdbc.update("INSERT INTO productos VALUES('sku', 8)");
        var route = new MessagingProperties.Route("test.main", "test.key", "test.dlq", "test.dead", 30000);
        var properties = new MessagingProperties("test.exchange", "test.dlx", route, route, route, 86400000, 3);
        consumer = new InventoryConsumer(new ManualAcknowledgement(properties, mock(ConfirmedPublisher.class)),
            new EventStore(jdbc, new TransactionTemplate(new DataSourceTransactionManager(source))), jdbc);
        channel = mock(Channel.class);
    }
    private Message event(String items) {
        var properties = new MessageProperties(); properties.setMessageId("event-1"); properties.setDeliveryTag(42);
        return new Message(("{\"boletaId\":12,\"items\":" + items + "}").getBytes(StandardCharsets.UTF_8), properties);
    }
    @Test void redeliveryRecordsOneMovementAndNeverDebitsReservedStockAgain() throws Exception {
        var message = event("[{\"productoId\":\"sku\",\"cantidad\":2,\"stockAfter\":8}]");
        consumer.consume(message, channel); consumer.consume(message, channel);
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM inventory_movements", Integer.class));
        assertEquals(8, jdbc.queryForObject("SELECT stock FROM productos", Integer.class));
        verify(channel, times(2)).basicAck(42, false);
    }
    @Test void invalidSecondItemRollsBackEntireEventBeforeNack() throws Exception {
        consumer.consume(event("[{\"productoId\":\"sku\",\"cantidad\":2,\"stockAfter\":8},{\"productoId\":\"sku-b\",\"cantidad\":-1}]"), channel);
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM inventory_movements", Integer.class));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM event_receipts", Integer.class));
        verify(channel).basicNack(42, false, false);
    }
}
