package cl.puntogamer.inventory;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/inventory")
public class InventoryController {
    private final JdbcTemplate jdbc;
    public InventoryController(JdbcTemplate jdbc){this.jdbc=jdbc;}
    @GetMapping("/movements")public List<Map<String,Object>> movements(){return jdbc.queryForList("SELECT * FROM inventory_movements ORDER BY registered_at DESC LIMIT 100");}
}
