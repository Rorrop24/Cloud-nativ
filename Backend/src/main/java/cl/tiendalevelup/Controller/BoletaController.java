package cl.tiendalevelup.Controller;

import cl.tiendalevelup.Entity.Boleta;
import cl.tiendalevelup.Service.BoletaService;
import cl.tiendalevelup.Service.PedidoProducerService;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/v2/boletas")
@Tag(name = "Boletas", description = "Operaciones relacionadas a la generación e historial de boletas")
public class BoletaController {

    @Autowired
    private BoletaService boletaService;

    @Autowired(required = false)
    private PedidoProducerService pedidoProducerService;

    /** Generar boleta desde carrito y emitir eventos a las colas de RabbitMQ */
    @Operation(summary = "Generar boleta desde carrito y notificar a RabbitMQ")
    @PostMapping("/generar")
    @PreAuthorize("@usuarioAccess.owns(authentication, #body['usuarioId'])")
    public Boleta generarBoleta(@RequestBody Map<String, Object> body) {

        int usuarioId = ((Number) body.get("usuarioId")).intValue();
        List<Map<String, Object>> items = (List<Map<String, Object>>) body.get("items");

        Boleta boletaGuardada = boletaService.generarBoleta(usuarioId, items, (String) body.get("requestId"));

        return boletaGuardada;
    }

    /** Obtener una boleta por ID */
    @Operation(summary = "Obtener una boleta por ID")
    @GetMapping("/{id}")
    @PreAuthorize("@usuarioAccess.ownsBoleta(authentication, #id)")
    public Boleta getBoleta(@PathVariable Long id) {
        return boletaService.getBoletaById(id);
    }

    /** Historial de boletas por usuario */
    @Operation(summary = "Historial de boletas de un usuario")
    @GetMapping("/usuario/{usuarioId}")
    @PreAuthorize("@usuarioAccess.owns(authentication, #usuarioId)")
    public List<Boleta> getBoletasByUsuario(@PathVariable int usuarioId) {
        return boletaService.getBoletasByUsuario(usuarioId);
    }
}
