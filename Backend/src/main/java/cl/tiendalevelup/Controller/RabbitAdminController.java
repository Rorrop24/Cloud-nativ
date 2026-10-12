package cl.tiendalevelup.Controller;

import cl.tiendalevelup.dto.QueueRequestDTO;
import cl.tiendalevelup.Service.RabbitAdminService; // S mayúscula
import jakarta.validation.Valid;
import org.springframework.amqp.core.QueueInformation;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/rabbitmq")
public class RabbitAdminController {

    private final RabbitAdminService adminService;

    public RabbitAdminController(RabbitAdminService adminService) {
        this.adminService = adminService;
    }

    @PostMapping("/queues")
    public ResponseEntity<Map<String, String>> createQueue(@Valid @RequestBody QueueRequestDTO request) {
        adminService.createQueue(request.getQueueName(), request.isDurable());
        Map<String, String> response = new HashMap<>();
        response.put("message", "Cola '" + request.getQueueName() + "' creada exitosamente");
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/queues/{queueName}")
    public ResponseEntity<?> getQueueInfo(@PathVariable String queueName) {
        QueueInformation info = adminService.getQueueInfo(queueName);
        if (info == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(info);
    }

    @DeleteMapping("/queues/{queueName}")
    public ResponseEntity<Map<String, String>> deleteQueue(@PathVariable String queueName) {
        boolean deleted = adminService.deleteQueue(queueName);
        Map<String, String> response = new HashMap<>();
        response.put("message", deleted ? "Cola '" + queueName + "' eliminada" : "No se encontró la cola");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/queues/{queueName}/purge")
    public ResponseEntity<Map<String, Object>> purgeQueue(@PathVariable String queueName) {
        int purged = adminService.purgeQueue(queueName);
        Map<String, Object> response = new HashMap<>();
        response.put("message", "Cola purgada correctamente");
        response.put("mensajesEliminados", purged);
        return ResponseEntity.ok(response);
    }
}
