package cl.puntogamer.messaging;
import java.util.*;
import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.*;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.transaction.support.TransactionTemplate;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;
class DurableEventsTest {
    JdbcTemplate jdbc;TransactionTemplate tx;Outbox outbox;ConfirmedPublisher publisher;EventStore store;
    @BeforeEach void setup(){var source=new JdbcDataSource();source.setURL("jdbc:h2:mem:"+UUID.randomUUID()+";MODE=MySQL;DB_CLOSE_DELAY=-1");new ResourceDatabasePopulator(new ClassPathResource("schema.sql")).execute(source);jdbc=new JdbcTemplate(source);tx=new TransactionTemplate(new DataSourceTransactionManager(source));publisher=mock(ConfirmedPublisher.class);outbox=new Outbox(jdbc,tx,publisher,"test");store=new EventStore(jdbc,tx);jdbc.execute("CREATE TABLE effects(id INT PRIMARY KEY,value_count INT)");jdbc.update("INSERT INTO effects VALUES(1,0)");}
    @Test void rollbackAlsoRemovesQueuedEvents(){tx.executeWithoutResult(status->{outbox.enqueue("test.exchange","test.key",Map.of("id",1));status.setRollbackOnly();});assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM messaging_outbox",Integer.class));}
    @Test void confirmedPublicationIsMarkedDelivered(){outbox.enqueue("test.exchange","test.key",Map.of("id",1));assertTrue(outbox.dispatchOne());assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM messaging_outbox WHERE delivered_at IS NOT NULL",Integer.class));}
    @Test void unconfirmedPublicationStaysPending(){doThrow(new IllegalStateException("Broker no disponible")).when(publisher).send(anyString(),anyString(),any(),anyString());outbox.enqueue("test.exchange","test.key",Map.of("id",1));outbox.dispatchOne();assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM messaging_outbox WHERE delivered_at IS NULL AND attempts=1",Integer.class));}
    @Test void duplicateDeliveryDoesNotRepeatBusinessEffect(){Runnable action=()->jdbc.update("UPDATE effects SET value_count=value_count+1 WHERE id=1");store.process("pedidos","event-1","ref",action);store.process("pedidos","event-1","ref",action);assertEquals(1,jdbc.queryForObject("SELECT value_count FROM effects WHERE id=1",Integer.class));}
    @Test void processingFailureRollsBackReceiptAndBusinessChanges(){assertThrows(IllegalArgumentException.class,()->store.process("pedidos","event-1","ref",()->{jdbc.update("UPDATE effects SET value_count=1 WHERE id=1");throw new IllegalArgumentException("fallo");}));assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM event_receipts",Integer.class));assertEquals(0,jdbc.queryForObject("SELECT value_count FROM effects WHERE id=1",Integer.class));}
}
