package cl.puntogamer.bff;

import java.util.Map;
import jakarta.validation.constraints.Pattern;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController
@Validated
public class BffController {
    private final BackendClient backend;

    public BffController(BackendClient backend) { this.backend = backend; }

    @GetMapping("/health")
    public Map<String, String> health() { return Map.of("status", "UP"); }

    @GetMapping({"/api/bff/catalogo-completo", "/bff/home-data"})
    public Map<String, Object> catalog(JwtAuthenticationToken principal) {
        return backend.catalog(principal.getToken().getTokenValue());
    }

    @GetMapping("/api/bff/me")
    public Map<String, Object> me(JwtAuthenticationToken principal) {
        return Map.of("subject", principal.getToken().getSubject(), "authorities",
                principal.getAuthorities().stream().map(a -> a.getAuthority()).toList());
    }

    @PostMapping("/api/bff/profile")
    public Object profile(JwtAuthenticationToken principal) {
        return backend.profile(principal.getToken().getTokenValue());
    }

    @GetMapping("/api/bff/admin/queues/{name}")
    public Object queue(@PathVariable @Pattern(regexp = "[a-zA-Z0-9._-]{1,100}") String name,
            JwtAuthenticationToken principal) {
        return backend.queue(name, principal.getToken().getTokenValue());
    }
}
