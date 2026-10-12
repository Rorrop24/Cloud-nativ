package cl.tiendalevelup.Service;

import cl.tiendalevelup.config.RabbitMQConfig;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

@Service
public class PedidoProducerService {

    @Autowired
    private RabbitTemplate rabbitTemplate;

    private final ObjectMapper objectMapper = new ObjectMapper();

    // =========================================================================
    // 1. PUBLICACIÓN GENERAL / PEDIDOS (pedidos.queue)
    // =========================================================================
    public void enviarPedido(String idPedido, String mensajeDetalle) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("idPedido", idPedido);
            payload.put("mensaje", mensajeDetalle);
            payload.put("timestamp", System.currentTimeMillis());

            String jsonPayload = objectMapper.writeValueAsString(payload);

            rabbitTemplate.convertAndSend(
                RabbitMQConfig.PEDIDOS_EXCHANGE,
                RabbitMQConfig.PEDIDOS_ROUTING_KEY,
                jsonPayload
            );

            System.out.println("[PRODUCER] Mensaje enviado a pedidos.queue -> ID: " + idPedido);
        } catch (Exception e) {
            System.err.println("[PRODUCER ERROR] Error enviando pedido: " + e.getMessage());
        }
    }

    // =========================================================================
    // 2. SIMULACIÓN DIRECTA A INVENTARIO (inventario.queue)
    // =========================================================================
    public void enviarAInventario(String idRef, String mensajeDetalle) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("idRef", idRef);
            payload.put("mensaje", mensajeDetalle);
            payload.put("timestamp", System.currentTimeMillis());

            String jsonPayload = objectMapper.writeValueAsString(payload);

            rabbitTemplate.convertAndSend(
                RabbitMQConfig.PEDIDOS_EXCHANGE,
                RabbitMQConfig.INVENTARIO_ROUTING_KEY, // "pedido.stock"
                jsonPayload
            );

            System.out.println("[PRODUCER] Mensaje emitido directamente a inventario.queue -> ID: " + idRef);
        } catch (Exception e) {
            System.err.println("[PRODUCER ERROR] Error enviando a inventario: " + e.getMessage());
        }
    }

    // =========================================================================
    // 3. SIMULACIÓN DIRECTA A NOTIFICACIONES (notificaciones.queue)
    // =========================================================================
    public void enviarANotificaciones(String idRef, String mensajeDetalle) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("idRef", idRef);
            payload.put("mensaje", mensajeDetalle);
            payload.put("timestamp", System.currentTimeMillis());

            String jsonPayload = objectMapper.writeValueAsString(payload);

            rabbitTemplate.convertAndSend(
                RabbitMQConfig.PEDIDOS_EXCHANGE,
                RabbitMQConfig.NOTIFICACIONES_ROUTING_KEY, // "pedido.notificacion"
                jsonPayload
            );

            System.out.println("[PRODUCER] Mensaje emitido directamente a notificaciones.queue -> ID: " + idRef);
        } catch (Exception e) {
            System.err.println("[PRODUCER ERROR] Error enviando a notificaciones: " + e.getMessage());
        }
    }

    // =========================================================================
    // 4. EMISIÓN CONCURRENTE DE COMPRA (Pedidos, Notificaciones, Inventario)
    // =========================================================================
    public void publicarEventosDeCompra(Long boletaId, Object itemsCarrito, Double total, String email) {
        try {
            // 1. Facturación / Pedidos
            Map<String, Object> msgPedido = new HashMap<>();
            msgPedido.put("boletaId", boletaId);
            msgPedido.put("total", total);
            msgPedido.put("estado", "PAGADO");

            rabbitTemplate.convertAndSend(
                RabbitMQConfig.PEDIDOS_EXCHANGE, 
                RabbitMQConfig.PEDIDOS_ROUTING_KEY, 
                objectMapper.writeValueAsString(msgPedido)
            );

            // 2. Email / Notificaciones
            Map<String, Object> msgNotif = new HashMap<>();
            msgNotif.put("boletaId", boletaId);
            msgNotif.put("destinatario", (email != null && !email.isBlank()) ? email : "cliente@tiendalevelup.cl");
            msgNotif.put("mensaje", "Tu compra por $" + total + " fue procesada con éxito.");

            rabbitTemplate.convertAndSend(
                RabbitMQConfig.PEDIDOS_EXCHANGE, 
                RabbitMQConfig.NOTIFICACIONES_ROUTING_KEY, 
                objectMapper.writeValueAsString(msgNotif)
            );

            // 3. Stock / Inventario
            Map<String, Object> msgStock = new HashMap<>();
            msgStock.put("boletaId", boletaId);
            msgStock.put("items", itemsCarrito);

            rabbitTemplate.convertAndSend(
                RabbitMQConfig.PEDIDOS_EXCHANGE, 
                RabbitMQConfig.INVENTARIO_ROUTING_KEY, 
                objectMapper.writeValueAsString(msgStock)
            );

            System.out.println("[PRODUCER] Eventos distribuidos a las 3 colas para Boleta N° " + boletaId);
        } catch (Exception e) {
            System.err.println("[PRODUCER ERROR] Falla al publicar eventos: " + e.getMessage());
        }
    }
}