package cl.tiendalevelup.Consumer;

import cl.tiendalevelup.config.RabbitMQConfig;
import com.rabbitmq.client.Channel;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.support.AmqpHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
public class PedidoConsumer {

    /**
     * 1. CONSUMIDOR DE DOMINIO: PEDIDOS
     * Escucha la cola principal de compras y transacciones.
     */
    @RabbitListener(queues = RabbitMQConfig.PEDIDOS_QUEUE, ackMode = "MANUAL")
    public void consumirPedido(Message message, Channel channel,
                               @Header(AmqpHeaders.DELIVERY_TAG) long deliveryTag) throws IOException {
        String payload = new String(message.getBody());
        System.out.println("\n--------------------------------------------------");
        System.out.println("[PEDIDOS] Recibido evento de orden: " + payload);

        try {
            // Pausa controlada de 3 segundos para visualización técnica en consola web RabbitMQ
            Thread.sleep(3000);

            // Simulación o detección explícita de error de pago / transacción rechazada
            if (payload.contains("ERROR") || payload.contains("PAY-FAIL") || payload.contains("PAY-CANCEL")) {
                System.err.println("[PEDIDOS ERROR] Transacción inválida o rechazada. Desviando a Dead Letter Queue (DLQ)...");
                
                // NACK con requeue=false activa el envío inmediato al Dead Letter Exchange
                channel.basicNack(deliveryTag, false, false);
                return;
            }

            // Confirmación exitosa (ACK manual)
            channel.basicAck(deliveryTag, false);
            System.out.println("[PEDIDOS SUCCESS] Pedido validado y procesado exitosamente (ACK enviado).");

        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            System.err.println("[PEDIDOS ERROR] Hilo interrumpido durante procesamiento: " + ie.getMessage());
            channel.basicNack(deliveryTag, false, false);
        } catch (Exception e) {
            System.err.println("[PEDIDOS CRITICAL] Excepción imprevista en pedido: " + e.getMessage());
            channel.basicNack(deliveryTag, false, false);
        }
    }

    /**
     * 2. CONSUMIDOR DE DOMINIO: INVENTARIO
     * Escucha eventos para rebajar stock en bodega / Oracle DB.
     */
    @RabbitListener(queues = RabbitMQConfig.INVENTARIO_QUEUE, ackMode = "MANUAL")
    public void consumirInventario(Message message, Channel channel,
                                   @Header(AmqpHeaders.DELIVERY_TAG) long deliveryTag) throws IOException {
        String payload = new String(message.getBody());
        System.out.println("\n--------------------------------------------------");
        System.out.println("[INVENTARIO] Solicitud de descuento de stock recibida: " + payload);

        try {
            // Pausa controlada de 3 segundos para visualización técnica en RabbitMQ UI
            Thread.sleep(3000);

            // Regla de negocio / Simulación: detección de quiebre de stock o producto erróneo
            if (payload.contains("ERROR_STOCK") || payload.contains("fail")) {
                System.err.println("[INVENTARIO ERROR] Stock insuficiente en bodega o producto no existe. Rechazando a DLQ...");
                channel.basicNack(deliveryTag, false, false);
                return;
            }

            // Confirmación exitosa de actualización de stock
            channel.basicAck(deliveryTag, false);
            System.out.println("[INVENTARIO SUCCESS] Stock rebajado en base de datos (ACK enviado).");

        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            System.err.println("[INVENTARIO ERROR] Hilo interrumpido en inventario: " + ie.getMessage());
            channel.basicNack(deliveryTag, false, false);
        } catch (Exception e) {
            System.err.println("[INVENTARIO CRITICAL] Error de consistencia en inventario: " + e.getMessage());
            channel.basicNack(deliveryTag, false, false);
        }
    }

    /**
     * 3. CONSUMIDOR DE DOMINIO: NOTIFICACIONES
     * Escucha eventos para despacho de comprobantes y correos SMTP.
     */
    @RabbitListener(queues = RabbitMQConfig.NOTIFICACIONES_QUEUE, ackMode = "MANUAL")
    public void consumirNotificacion(Message message, Channel channel,
                                     @Header(AmqpHeaders.DELIVERY_TAG) long deliveryTag) throws IOException {
        String payload = new String(message.getBody());
        System.out.println("\n--------------------------------------------------");
        System.out.println("[NOTIFICACIONES] Preparando despacho de comprobante: " + payload);

        try {
            // Pausa controlada de 3 segundos para visualización técnica en RabbitMQ UI
            Thread.sleep(3000);

            // Regla de negocio / Simulación: servidor SMTP no responde o correo inválido
            if (payload.contains("ERROR_NOTIFICACION") || payload.contains("smtp_fail")) {
                System.err.println("[NOTIFICACIONES ERROR] Fallo de conexión SMTP. Notificación desviada a DLQ para auditoría...");
                channel.basicNack(deliveryTag, false, false);
                return;
            }

            // Confirmación de envío de correo
            channel.basicAck(deliveryTag, false);
            System.out.println("[NOTIFICACIONES SUCCESS] Correo de compra enviado al cliente (ACK enviado).");

        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            System.err.println("[NOTIFICACIONES ERROR] Hilo interrumpido en notificaciones: " + ie.getMessage());
            channel.basicNack(deliveryTag, false, false);
        } catch (Exception e) {
            System.err.println("[NOTIFICACIONES CRITICAL] Excepción al procesar correo: " + e.getMessage());
            channel.basicNack(deliveryTag, false, false);
        }
    }
}