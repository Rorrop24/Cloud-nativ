package cl.puntogamer.bff;

import org.junit.jupiter.api.*;
import org.springframework.http.*;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class BackendClientTest {
    MockRestServiceServer server;
    BackendClient backend;
    @BeforeEach void setup() {
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        backend = new BackendClient(builder, "http://backend.test");
    }
    @Test void aggregatesAndForwardsBearerToBothServices() {
        server.expect(requestTo("http://backend.test/v2/productos/todos"))
                .andExpect(header("Authorization", "Bearer access-token"))
                .andRespond(withSuccess("[{\"id\":\"1\",\"nombre\":\"Mouse\"}]", MediaType.APPLICATION_JSON));
        server.expect(requestTo("http://backend.test/v2/categorias/todas"))
                .andExpect(header("Authorization", "Bearer access-token"))
                .andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));
        assertTrue(backend.catalog("access-token").containsKey("catalogo"));
        server.verify();
    }
    @Test void doesNotHideBackendFailuresAsEmptyCatalog() {
        server.expect(requestTo("http://backend.test/v2/productos/todos"))
                .andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE));
        assertThrows(RestClientResponseException.class, () -> backend.catalog("access-token"));
        server.verify();
    }
}
