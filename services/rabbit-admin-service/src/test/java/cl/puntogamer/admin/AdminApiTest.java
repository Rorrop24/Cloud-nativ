package cl.puntogamer.admin;
import cl.puntogamer.messaging.ServiceSecurityConfiguration;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.mockito.Mockito.*;
@WebMvcTest(controllers=RabbitAdminController.class,properties={"spring.application.name=admin-test","app.security.allowed-origins=http://localhost:4200"})
@ContextConfiguration(classes={RabbitAdminController.class,ServiceSecurityConfiguration.class})
class AdminApiTest {
    @Autowired MockMvc mvc;@MockitoBean RabbitAdminService service;@MockitoBean JwtDecoder decoder;@MockitoBean JdbcTemplate jdbc;
    private org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor admin(){return jwt().authorities(new SimpleGrantedAuthority("ROLE_Rabbit.Admin"));}
    @Test void missingTokenIs401()throws Exception{mvc.perform(post("/api/rabbitmq/queues").contentType("application/json").content("{\"queueName\":\"test\"}")).andExpect(status().isUnauthorized());}
    @Test void customerCannotAdministerBroker()throws Exception{mvc.perform(post("/api/rabbitmq/queues").with(jwt().authorities(new SimpleGrantedAuthority("SCOPE_Pedidos.Read"))).contentType("application/json").content("{\"queueName\":\"test\"}")).andExpect(status().isForbidden());}
    @Test void emptyQueueIs400AndNeverReachesBroker()throws Exception{mvc.perform(post("/api/rabbitmq/queues").with(admin()).contentType("application/json").content("{\"queueName\":\"\"}")).andExpect(status().isBadRequest());verifyNoInteractions(service);}
    @Test void invalidQuorumConfigurationIs400()throws Exception{mvc.perform(post("/api/rabbitmq/queues").with(admin()).contentType("application/json").content("{\"queueName\":\"test\",\"durable\":false}")).andExpect(status().isBadRequest());verifyNoInteractions(service);}
    @Test void createsQueue()throws Exception{mvc.perform(post("/api/rabbitmq/queues").with(admin()).contentType("application/json").content("{\"queueName\":\"test\",\"durable\":true}")).andExpect(status().isCreated());verify(service).createQueue(any());}
    @Test void createsAndDeletesExchange()throws Exception{mvc.perform(post("/api/rabbitmq/exchanges").with(admin()).contentType("application/json").content("{\"exchangeName\":\"test.exchange\",\"type\":\"topic\"}")).andExpect(status().isCreated());when(service.deleteExchange("test.exchange")).thenReturn(true);mvc.perform(delete("/api/rabbitmq/exchanges/test.exchange").with(admin())).andExpect(status().isNoContent());}
    @Test void invalidBindingIs400()throws Exception{mvc.perform(post("/api/rabbitmq/bindings").with(admin()).contentType("application/json").content("{\"queueName\":\"test\",\"exchangeName\":\"\",\"routingKey\":\"key\"}")).andExpect(status().isBadRequest());verifyNoInteractions(service);}
    @Test void createsAndDeletesBinding()throws Exception{String body="{\"queueName\":\"test\",\"exchangeName\":\"test.exchange\",\"routingKey\":\"key\"}";mvc.perform(post("/api/rabbitmq/bindings").with(admin()).contentType("application/json").content(body)).andExpect(status().isCreated());mvc.perform(delete("/api/rabbitmq/bindings").with(admin()).contentType("application/json").content(body)).andExpect(status().isNoContent());verify(service).createBinding(any());verify(service).deleteBinding(any());}
}
