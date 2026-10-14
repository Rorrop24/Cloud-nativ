package cl.puntogamer.notifications;
import cl.puntogamer.messaging.Identity;
import java.util.*;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/notifications")
public class NotificationController {
    private final JdbcTemplate jdbc;
    public NotificationController(JdbcTemplate jdbc){this.jdbc=jdbc;}
    @GetMapping public List<Map<String,Object>> list(@AuthenticationPrincipal Jwt jwt){return jdbc.queryForList("SELECT event_id,title,boleta_id,created_at FROM notification_documents WHERE owner=? ORDER BY created_at DESC LIMIT 100",Identity.owner(jwt));}
    @GetMapping("/{id}/document") public ResponseEntity<String> document(@AuthenticationPrincipal Jwt jwt,@PathVariable String id){
        var rows=jdbc.queryForList("SELECT content FROM notification_documents WHERE owner=? AND event_id=?",Identity.owner(jwt),id);
        if(rows.isEmpty())return ResponseEntity.notFound().build();
        return ResponseEntity.ok().contentType(MediaType.TEXT_HTML).header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=comprobante.html").header("Content-Security-Policy","default-src 'none'; style-src 'unsafe-inline'").body((String)rows.get(0).get("content"));
    }
}
