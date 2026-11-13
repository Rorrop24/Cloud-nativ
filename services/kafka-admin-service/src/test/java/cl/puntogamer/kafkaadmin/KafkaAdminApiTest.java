package cl.puntogamer.kafkaadmin;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cl.puntogamer.streaming.StreamSecurityConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = KafkaAdminController.class, properties = {
        "app.security.allowed-origins=http://localhost:4200",
        "app.security.issuer-uri=https://issuer.test/v2.0",
        "app.security.jwk-set-uri=http://localhost:1/keys",
        "app.security.audience=punto-gamer-api"})
@ContextConfiguration(classes = {KafkaAdminController.class, StreamSecurityConfiguration.class})
class KafkaAdminApiTest {
    @Autowired
    MockMvc mvc;
    @MockitoBean
    KafkaClusterService service;
    @MockitoBean
    JwtDecoder decoder;

    private JwtRequestPostProcessor admin() {
        return jwt().authorities(new SimpleGrantedAuthority("ROLE_Rabbit.Admin"));
    }

    @Test
    void healthIsPublicAndReportsBrokers() throws Exception {
        when(service.brokerCount()).thenReturn(3);
        mvc.perform(get("/health")).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP")).andExpect(jsonPath("$.brokers").value(3));
    }

    @Test
    void missingTokenIs401() throws Exception {
        mvc.perform(get("/api/kafka/topics")).andExpect(status().isUnauthorized());
    }

    @Test
    void customerCannotAdministerCluster() throws Exception {
        mvc.perform(get("/api/kafka/topics").with(jwt().authorities(new SimpleGrantedAuthority("SCOPE_Pedidos.Read"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void emptyTopicNameIs400AndNeverReachesKafka() throws Exception {
        mvc.perform(post("/api/kafka/topics").with(admin()).contentType("application/json").content("{\"name\":\"\"}"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }

    @Test
    void tooManyReplicasIs400() throws Exception {
        mvc.perform(post("/api/kafka/topics").with(admin()).contentType("application/json")
                .content("{\"name\":\"evidencia.ep3\",\"replicationFactor\":9}")).andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }

    @Test
    void createsAndDeletesTopic() throws Exception {
        mvc.perform(post("/api/kafka/topics").with(admin()).contentType("application/json")
                .content("{\"name\":\"evidencia.ep3\",\"partitions\":3,\"replicationFactor\":3}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.partitions").value(3));
        verify(service).createTopic(any());
        mvc.perform(delete("/api/kafka/topics/evidencia.ep3").with(admin())).andExpect(status().isNoContent());
        verify(service).deleteTopic("evidencia.ep3");
    }

    @Test
    void eventWithoutMessageIs400() throws Exception {
        mvc.perform(post("/api/kafka/events").with(admin()).contentType("application/json")
                .content("{\"topic\":\"pruebas.eventos\",\"message\":\"\"}")).andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }
}
