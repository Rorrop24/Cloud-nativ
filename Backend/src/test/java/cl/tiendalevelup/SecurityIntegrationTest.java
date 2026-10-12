package cl.tiendalevelup;

import cl.tiendalevelup.Entity.Usuario;
import cl.tiendalevelup.Repository.UsuarioRepository;
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
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class SecurityIntegrationTest {
    static final String TENANT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    static final String OBJECT = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
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
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("app.security.jwk-set-uri", () -> "http://127.0.0.1:" + JWKS.getAddress().getPort() + "/keys");
    }
    @AfterAll static void closeKeys() { JWKS.stop(0); }
    @Autowired MockMvc mvc;
    @Autowired UsuarioRepository users;
    @BeforeEach void clear() { users.deleteAll(); }

    static JWTClaimsSet.Builder claims() {
        return new JWTClaimsSet.Builder().subject("azure-user").issuer("https://issuer.test/v2.0")
                .audience("punto-gamer-api").expirationTime(Date.from(Instant.now().plusSeconds(300)))
                .claim("tid", TENANT).claim("oid", OBJECT).claim("scp", "Pedidos.Read")
                .claim("preferred_username", "cliente@example.test").claim("name", "Cliente Gamer");
    }
    static String sign(JWTClaimsSet.Builder claims, RSAKey key) throws Exception {
        SignedJWT jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID("test-key").build(), claims.build());
        jwt.sign(new RSASSASigner(key));
        return jwt.serialize();
    }
    static Stream<String> invalidTokens() throws Exception {
        return Stream.of("not-a-jwt",
                sign(claims().issuer("https://attacker.test"), KEY),
                sign(claims().audience("wrong-api"), KEY),
                sign(claims().audience((String) null), KEY),
                sign(claims().subject(null), KEY),
                sign(claims().expirationTime(Date.from(Instant.now().minusSeconds(1))), KEY),
                sign(claims().expirationTime(null), KEY),
                sign(claims().notBeforeTime(Date.from(Instant.now().plusSeconds(300))), KEY),
                sign(claims(), new RSAKeyGenerator(2048).keyID("test-key").generate()),
                new PlainJWT(claims().build()).serialize());
    }
    @ParameterizedTest @MethodSource("invalidTokens")
    void rejectsInvalidJwt(String token) throws Exception {
        mvc.perform(get("/v2/usuarios/todos").header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized()).andExpect(header().exists("WWW-Authenticate"));
    }
    @Test void missingTokenIs401() throws Exception {
        mvc.perform(get("/v2/usuarios/todos")).andExpect(status().isUnauthorized());
    }
    @Test void missingRoleIs403() throws Exception {
        mvc.perform(get("/v2/usuarios/todos").header("Authorization", "Bearer " + sign(claims(), KEY)))
                .andExpect(status().isForbidden());
    }
    @Test void adminRoleIsAllowed() throws Exception {
        mvc.perform(get("/v2/usuarios/todos").header("Authorization", "Bearer " +
                sign(claims().claim("roles", List.of("Rabbit.Admin")), KEY))).andExpect(status().isOk());
    }
    @Test void missingScopeIs403() throws Exception {
        mvc.perform(post("/v2/usuarios/sync-azure").header("Authorization", "Bearer " +
                sign(claims().claim("scp", ""), KEY))).andExpect(status().isForbidden());
    }
    @Test void syncUsesVerifiedClaimsAndHidesPassword() throws Exception {
        mvc.perform(post("/v2/usuarios/sync-azure").header("Authorization", "Bearer " + sign(claims(), KEY))
                .contentType("application/json").content("{\"email\":\"attacker@example.test\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.email").value("cliente@example.test"))
                .andExpect(jsonPath("$.password").doesNotExist());
    }
    @Test void userCannotReadAnotherProfile() throws Exception {
        Usuario other = new Usuario();
        other.setNombre("Otro"); other.setApellido("Usuario"); other.setEmail("otro@example.test");
        other.setRut("12345678-9"); other.setPassword("not-exposed"); other.setFechaNacimiento("2000-01-01");
        other.setRegion("RM"); other.setComuna("Santiago"); other.setTelefono("123"); other.setRol("ADMIN");
        other.setAzureSubject(TENANT + ":cccccccc-cccc-cccc-cccc-cccccccccccc");
        int id = users.save(other).getUsuarioId();
        mvc.perform(get("/v2/usuarios/buscar/id/" + id).header("Authorization", "Bearer " + sign(claims(), KEY)))
                .andExpect(status().isForbidden());
    }
    @Test void doesNotLinkLegacyAccountByEmail() throws Exception {
        Usuario user = new Usuario();
        user.setNombre("Legacy"); user.setApellido("User"); user.setEmail("cliente@example.test");
        user.setRut("22222222-2"); user.setPassword("hash"); user.setFechaNacimiento("2000-01-01");
        user.setRegion("RM"); user.setComuna("Santiago"); user.setTelefono("123"); user.setRol("USER");
        users.save(user);
        mvc.perform(post("/v2/usuarios/sync-azure").header("Authorization", "Bearer " + sign(claims(), KEY)))
                .andExpect(status().isConflict());
    }
    @Test void corsDoesNotAllowUnknownOrigin() throws Exception {
        mvc.perform(options("/v2/productos/todos").header("Origin", "https://attacker.test")
                .header("Access-Control-Request-Method", "GET")).andExpect(status().isForbidden());
    }
    @Test void catalogRemainsPublic() throws Exception {
        mvc.perform(get("/v2/productos/todos")).andExpect(status().isOk());
    }
}
