package cl.tiendalevelup.Controller;

import cl.tiendalevelup.Service.PedidoProducerService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/pedidos")
public class PedidoController {

    @Autowired
    private PedidoProducerService pedidoProducerService;

    // 1. Endpoint original de compras / fallo de pagos (pedidos.queue -> pedidos.dlq)
    @PostMapping("/crear")
    public ResponseEntity<?> crearPedido(@RequestBody Map<String, String> body) {
        String cliente = body.getOrDefault("cliente", "PED-" + System.currentTimeMillis());
        String detalle = body.getOrDefault("detalle", "Pedido procesado");
        
        pedidoProducerService.enviarPedido(cliente, detalle);
        return ResponseEntity.ok(Map.of("mensaje", "Evento enviado a pedidos.queue"));
    }

    // 2. NUEVO: Simulación de fallo en stock (inventario.queue -> inventario.dlq)
    @PostMapping("/simular/inventario")
    public ResponseEntity<?> simularInventario(@RequestBody Map<String, String> body) {
        String cliente = body.getOrDefault("cliente", "INV-" + System.currentTimeMillis());
        String detalle = body.getOrDefault("detalle", "ERROR_STOCK: Sin stock físico");
        
        pedidoProducerService.enviarAInventario(cliente, detalle);
        return ResponseEntity.ok(Map.of("mensaje", "Evento enviado a inventario.queue"));
    }

    // 3. NUEVO: Simulación de fallo en correo (notificaciones.queue -> notificaciones.dlq)
    @PostMapping("/simular/notificaciones")
    public ResponseEntity<?> simularNotificaciones(@RequestBody Map<String, String> body) {
        String cliente = body.getOrDefault("cliente", "NOTIF-" + System.currentTimeMillis());
        String detalle = body.getOrDefault("detalle", "ERROR_NOTIFICACION: Servidor SMTP caído");
        
        pedidoProducerService.enviarANotificaciones(cliente, detalle);
        return ResponseEntity.ok(Map.of("mensaje", "Evento enviado a notificaciones.queue"));
    }
}
