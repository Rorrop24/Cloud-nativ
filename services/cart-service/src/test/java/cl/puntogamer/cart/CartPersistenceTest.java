package cl.puntogamer.cart;
import cl.puntogamer.messaging.*;
import java.util.*;
import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.*;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.client.RestClient;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class CartPersistenceTest {
    CartService service;JdbcTemplate jdbc;MockRestServiceServer server;TransactionTemplate tx;
    @BeforeEach void setup(){var source=new JdbcDataSource();source.setURL("jdbc:h2:mem:"+UUID.randomUUID()+";MODE=MySQL;DB_CLOSE_DELAY=-1");new ResourceDatabasePopulator(new ClassPathResource("schema.sql")).execute(source);jdbc=new JdbcTemplate(source);tx=new TransactionTemplate(new DataSourceTransactionManager(source));var builder=RestClient.builder();server=MockRestServiceServer.bindTo(builder).build();var route=new MessagingProperties.Route("test.main","test.key","test.dlq","test.dead",30000);service=new CartService(jdbc,builder,"http://backend.test",new Outbox(jdbc,tx,mock(ConfirmedPublisher.class),"cart-test"),new MessagingProperties("test.exchange","test.dlx",route,route,route,86400000,3));}
    @Test void persistsCartAndKeepsOwnersSeparate(){server.expect(requestTo("http://backend.test/v2/productos/buscar/id/sku")).andRespond(withSuccess("{\"id\":\"sku\",\"stock\":5,\"precio\":100}",org.springframework.http.MediaType.APPLICATION_JSON));tx.executeWithoutResult(status->service.add("owner-a","sku",2));assertEquals(2,jdbc.queryForObject("SELECT quantity FROM cart_lines WHERE owner='owner-a'",Integer.class));assertEquals(List.of(),service.get("owner-b").get("items"));assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM messaging_outbox",Integer.class));server.verify();}
    @Test void invalidQuantityDoesNotWriteCartOrOutbox(){assertThrows(IllegalArgumentException.class,()->service.add("owner-a","sku",-1));assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM cart_lines",Integer.class));assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM messaging_outbox",Integer.class));}
    @Test void stockFailureLeavesNoPartialCart(){server.expect(requestTo("http://backend.test/v2/productos/buscar/id/sku")).andRespond(withSuccess("{\"id\":\"sku\",\"stock\":1,\"precio\":100}",org.springframework.http.MediaType.APPLICATION_JSON));assertThrows(org.springframework.web.server.ResponseStatusException.class,()->tx.executeWithoutResult(status->service.add("owner-a","sku",2)));assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM cart_lines",Integer.class));}
    @Test void retryAfterLostOrderResponseReusesIdempotencyKeyAndKeepsCartUntilSuccess() throws Exception {
        jdbc.update("INSERT INTO cart_lines(owner,product_id,quantity) VALUES('owner-a','sku',2)");
        var key = new java.util.concurrent.atomic.AtomicReference<String>();
        var json = new com.fasterxml.jackson.databind.ObjectMapper();
        var media = org.springframework.http.MediaType.APPLICATION_JSON;
        server.expect(requestTo("http://backend.test/v2/usuarios/sync-azure")).andRespond(withSuccess("{\"usuarioId\":1}",media));
        server.expect(requestTo("http://backend.test/v2/boletas/generar")).andExpect(request -> {
            var body=((org.springframework.mock.http.client.MockClientHttpRequest)request).getBodyAsString();
            key.set(json.readTree(body).path("requestId").asText());
        }).andRespond(withServerError());
        server.expect(requestTo("http://backend.test/v2/usuarios/sync-azure")).andRespond(withSuccess("{\"usuarioId\":1}",media));
        server.expect(requestTo("http://backend.test/v2/boletas/generar")).andExpect(request -> {
            var body=((org.springframework.mock.http.client.MockClientHttpRequest)request).getBodyAsString();
            assertEquals(key.get(),json.readTree(body).path("requestId").asText());
        }).andRespond(withSuccess("{\"id\":12,\"total\":200}",media));
        assertThrows(org.springframework.web.client.HttpServerErrorException.class,()->tx.execute(status->service.checkout("owner-a","token")));
        assertTrue(key.get().startsWith("CART-"));
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM cart_lines",Integer.class));
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM cart_checkout_attempt",Integer.class));
        var receipt=(Map<?,?>)tx.execute(status->service.checkout("owner-a","token"));
        assertEquals(12,receipt.get("id"));
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM cart_lines",Integer.class));
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM cart_checkout_attempt",Integer.class));
        server.verify();
    }
}
