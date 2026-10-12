package cl.puntogamer.bff;

import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.*;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.*;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.stream.Stream;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.*;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class BffSecurityTest {
    static final RSAKey KEY;
    static final HttpServer JWKS;
    static {
        try {
            KEY = new RSAKeyGenerator(2048).keyID("test-key").generate();
            JWKS = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            JWKS.createContext("/keys", exchange -> {
                byte[] data = new JWKSet(KEY.toPublicJWK()).toString().getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, data.length);
                exchange.getResponseBody().write(data);
                exchange.close();
            });
            JWKS.start();
        } catch (Exception error) { throw new ExceptionInInitializerError(error); }
    }
    @DynamicPropertySource
    static void config(DynamicPropertyRegistry registry) {
        registry.add("app.security.issuer-uri", () -> "https://issuer.test/v2.0");
        registry.add("app.security.audience", () -> "punto-gamer-api");
        registry.add("app.security.jwk-set-uri", () -> "http://127.0.0.1:" + JWKS.getAddress().getPort() + "/keys");
    }
    @AfterAll static void stop() { JWKS.stop(0); }
    @Autowired MockMvc mvc;
    @MockitoBean BackendClient backend;

    static JWTClaimsSet.Builder claims() {
        return new JWTClaimsSet.Builder().subject("azure-user").issuer("https://issuer.test/v2.0")
                .audience("punto-gamer-api").expirationTime(Date.from(Instant.now().plusSeconds(300)))
                .claim("scp", "Pedidos.Read");
    }
    static String sign(JWTClaimsSet.Builder claims, RSAKey key) throws Exception {
        SignedJWT jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID("test-key").build(), claims.build());
        jwt.sign(new RSASSASigner(key));
        return jwt.serialize();
    }
    static Stream<String> invalidTokens() throws Exception {
        return Stream.of("not-a-jwt", sign(claims().issuer("https://attacker.test"), KEY),
                sign(claims().audience("wrong-api"), KEY), sign(claims().audience((String) null), KEY),
                sign(claims().expirationTime(Date.from(Instant.now().minusSeconds(1))), KEY),
                sign(claims().expirationTime(null), KEY),
                sign(claims().notBeforeTime(Date.from(Instant.now().plusSeconds(300))), KEY),
                sign(claims(), new RSAKeyGenerator(2048).keyID("test-key").generate()),
                new PlainJWT(claims().build()).serialize());
    }
    @ParameterizedTest @MethodSource("invalidTokens")
    void rejectsInvalidToken(String token) throws Exception {
        mvc.perform(get("/api/bff/catalogo-completo").header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(backend);
    }
    @Test void rejectsAnonymous() throws Exception {
        mvc.perform(get("/api/bff/catalogo-completo")).andExpect(status().isUnauthorized());
    }
    @Test void rejectsMissingScope() throws Exception {
        mvc.perform(get("/api/bff/catalogo-completo").header("Authorization", "Bearer " +
                sign(claims().claim("scp", ""), KEY))).andExpect(status().isForbidden());
    }
    @Test void forwardsSameVerifiedAccessToken() throws Exception {
        String token = sign(claims(), KEY);
        when(backend.catalog(token)).thenReturn(Map.of("catalogo", List.of()));
        mvc.perform(get("/api/bff/catalogo-completo").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.catalogo").isArray());
        verify(backend).catalog(token);
    }
    @Test void deniesAdminWithoutRole() throws Exception {
        mvc.perform(get("/api/bff/admin/queues/pedidos.queue")
                .header("Authorization", "Bearer " + sign(claims(), KEY))).andExpect(status().isForbidden());
    }
    @Test void allowsAzureAdminRole() throws Exception {
        String token = sign(claims().claim("roles", List.of("Rabbit.Admin")), KEY);
        when(backend.queue("pedidos.queue", token)).thenReturn(Map.of("messages", 0));
        mvc.perform(get("/api/bff/admin/queues/pedidos.queue").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
        verify(backend).queue("pedidos.queue", token);
    }
    @Test void validatesQueueName() throws Exception {
        mvc.perform(get("/api/bff/admin/queues/invalid!").header("Authorization", "Bearer " +
                sign(claims().claim("roles", List.of("Rabbit.Admin")), KEY))).andExpect(status().isBadRequest());
        verifyNoInteractions(backend);
    }
    @Test void healthIsPublic() throws Exception {
        mvc.perform(get("/health")).andExpect(status().isOk());
    }

    @Test void profileForwardsOnlyVerifiedIdentity() throws Exception {
        String token = sign(claims(), KEY);
        when(backend.profile(token)).thenReturn(Map.of("email", "verified@example.test"));
        mvc.perform(post("/api/bff/profile").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.email").value("verified@example.test"));
        verify(backend).profile(token);
    }
}
