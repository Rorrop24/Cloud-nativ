package cl.puntogamer.messaging;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
@RestController
public class ServiceHealthController {
    private final JdbcTemplate jdbc; private final String name;
    public ServiceHealthController(JdbcTemplate jdbc,String name){this.jdbc=jdbc;this.name=name;}
    @GetMapping("/health") public Map<String,String> health(){jdbc.queryForObject("SELECT 1",Integer.class);return Map.of("status","UP","service",name);}
}
