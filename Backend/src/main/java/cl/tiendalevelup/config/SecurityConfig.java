package cl.tiendalevelup.config;

import java.util.Arrays;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.*;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.*;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, @Qualifier("corsConfigurationSource") CorsConfigurationSource cors,
            JwtAuthenticationConverter jwtConverter) throws Exception {
        return http.cors(c -> c.configurationSource(cors)).csrf(c -> c.disable())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                    .requestMatchers("/error", "/health").permitAll()
                    .requestMatchers("/v2/usuarios/login").denyAll()
                    .requestMatchers(HttpMethod.GET, "/v2/productos/**", "/v2/categorias/**",
                            "/v2/imagenes/**", "/v2/resenias/**", "/images/**").permitAll()
                    .requestMatchers("/api/rabbitmq/**", "/api/pedidos/simular/**").hasRole("Rabbit.Admin")
                    .requestMatchers("/v2/usuarios/sync-azure", "/v2/usuarios/buscar/id/**",
                            "/v2/usuarios/actualizar", "/v2/carrito/**", "/v2/boletas/**")
                        .hasAnyAuthority("SCOPE_Pedidos.Read", "ROLE_Rabbit.Admin")
                    .requestMatchers(HttpMethod.POST, "/api/pedidos/crear", "/v2/resenias/**")
                        .hasAnyAuthority("SCOPE_Pedidos.Read", "ROLE_Rabbit.Admin")
                    .anyRequest().hasRole("Rabbit.Admin"))
                // BearerTokenAuthenticationFilter handles missing/invalid JWT with 401, and denied roles with 403.
                .oauth2ResourceServer(oauth -> oauth.jwt(jwt -> jwt.jwtAuthenticationConverter(jwtConverter)))
                .build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource(
            @Value("${app.security.allowed-origins}") String origins) {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(Arrays.stream(origins.split(",")).map(String::trim)
                .filter(s -> !s.isBlank()).toList());
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        config.setExposedHeaders(List.of("WWW-Authenticate"));
        config.setAllowCredentials(false);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
