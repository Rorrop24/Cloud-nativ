package cl.puntogamer.messaging;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.*;
@Configuration @Import({AzureJwtConfiguration.class,ApiErrors.class})
public class ServiceSecurityConfiguration {
    @Bean SecurityFilterChain serviceSecurity(HttpSecurity http,JwtAuthenticationConverter converter) throws Exception {
        return http.cors(cors -> {}).csrf(csrf -> csrf.disable()).sessionManagement(s->s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(a->a.requestMatchers("/health","/error").permitAll()
            .requestMatchers("/api/rabbitmq/**","/api/inventory/**").hasRole("Rabbit.Admin")
            .anyRequest().hasAnyAuthority("SCOPE_Pedidos.Read","ROLE_Rabbit.Admin"))
            .oauth2ResourceServer(o->o.jwt(j->j.jwtAuthenticationConverter(converter))).build();
    }
    @Bean CorsConfigurationSource corsConfigurationSource(@Value("${app.security.allowed-origins}") String origins) {
        var config=new CorsConfiguration(); config.setAllowedOrigins(Arrays.stream(origins.split(",")).map(String::trim).toList());
        config.setAllowedMethods(List.of("GET","POST","PUT","DELETE","OPTIONS")); config.setAllowedHeaders(List.of("Authorization","Content-Type"));
        var source=new UrlBasedCorsConfigurationSource(); source.registerCorsConfiguration("/**",config); return source;
    }
    @Bean ServiceHealthController serviceHealthController(org.springframework.jdbc.core.JdbcTemplate jdbc,@Value("${spring.application.name}") String name) { return new ServiceHealthController(jdbc,name); }
}
