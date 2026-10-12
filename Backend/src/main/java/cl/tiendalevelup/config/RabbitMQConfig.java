package cl.tiendalevelup.config;

import org.springframework.amqp.core.*;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    // EXCHANGES 
    public static final String PEDIDOS_EXCHANGE = "pedidos.exchange";
    public static final String PEDIDOS_DLX = "pedidos.dlx";

    // ROUTING KEYS PRINCIPALES
    public static final String PEDIDOS_ROUTING_KEY = "pedido.creado";
    public static final String NOTIFICACIONES_ROUTING_KEY = "pedido.notificacion";
    public static final String INVENTARIO_ROUTING_KEY = "pedido.stock";

    // ROUTING KEYS INDEPENDIENTES PARA DLQ
    public static final String PEDIDOS_DLQ_KEY = "pedidos.dead";
    public static final String NOTIFICACIONES_DLQ_KEY = "notificaciones.dead";
    public static final String INVENTARIO_DLQ_KEY = "inventario.dead";

    //  COLAS PRINCIPALES
    public static final String PEDIDOS_QUEUE = "pedidos.queue";
    public static final String NOTIFICACIONES_QUEUE = "notificaciones.queue";
    public static final String INVENTARIO_QUEUE = "inventario.queue";

    // COLAS DLQ INDEPENDIENTES
    public static final String PEDIDOS_DLQ = "pedidos.dlq";
    public static final String NOTIFICACIONES_DLQ = "notificaciones.dlq";
    public static final String INVENTARIO_DLQ = "inventario.dlq";

    @Bean
    public MessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    // ================= EXCHANGES =================

    @Bean
    public DirectExchange pedidosExchange() {
        return new DirectExchange(PEDIDOS_EXCHANGE, true, false);
    }

    @Bean
    public DirectExchange deadLetterExchange() {
        return new DirectExchange(PEDIDOS_DLX, true, false);
    }

    // 1. DOMINIO: PEDIDOS 

    @Bean
    public Queue pedidosQueue() {
        return QueueBuilder.durable(PEDIDOS_QUEUE)
                .withArgument("x-message-ttl", 30000)
                .withArgument("x-dead-letter-exchange", PEDIDOS_DLX)
                .withArgument("x-dead-letter-routing-key", PEDIDOS_DLQ_KEY)
                .withArgument("x-max-length", 1000)
                .build();
    }

    @Bean
    public Binding pedidosBinding(Queue pedidosQueue, DirectExchange pedidosExchange) {
        return BindingBuilder.bind(pedidosQueue).to(pedidosExchange).with(PEDIDOS_ROUTING_KEY);
    }

    @Bean
    public Queue pedidosDlq() {
        return QueueBuilder.durable(PEDIDOS_DLQ)
                .withArgument("x-message-ttl", 86400000) 
                .build();
    }

    @Bean
    public Binding pedidosDlqBinding(Queue pedidosDlq, DirectExchange deadLetterExchange) {
        return BindingBuilder.bind(pedidosDlq).to(deadLetterExchange).with(PEDIDOS_DLQ_KEY);
    }

    // 2. DOMINIO: NOTIFICACIONES 

    @Bean
    public Queue notificacionesQueue() {
        return QueueBuilder.durable(NOTIFICACIONES_QUEUE)
                .withArgument("x-message-ttl", 60000)
                .withArgument("x-dead-letter-exchange", PEDIDOS_DLX)
                .withArgument("x-dead-letter-routing-key", NOTIFICACIONES_DLQ_KEY)
                .build();
    }

    @Bean
    public Binding notificacionesBinding(Queue notificacionesQueue, DirectExchange pedidosExchange) {
        return BindingBuilder.bind(notificacionesQueue).to(pedidosExchange).with(NOTIFICACIONES_ROUTING_KEY);
    }

    @Bean
    public Queue notificacionesDlq() {
        return QueueBuilder.durable(NOTIFICACIONES_DLQ)
                .withArgument("x-message-ttl", 86400000)
                .build();
    }

    @Bean
    public Binding notificacionesDlqBinding(Queue notificacionesDlq, DirectExchange deadLetterExchange) {
        return BindingBuilder.bind(notificacionesDlq).to(deadLetterExchange).with(NOTIFICACIONES_DLQ_KEY);
    }

    // 3. DOMINIO: INVENTARIO

    @Bean
    public Queue inventarioQueue() {
        return QueueBuilder.durable(INVENTARIO_QUEUE)
                .withArgument("x-message-ttl", 60000)
                .withArgument("x-dead-letter-exchange", PEDIDOS_DLX)
                .withArgument("x-dead-letter-routing-key", INVENTARIO_DLQ_KEY) 
                .build();
    }

    @Bean
    public Binding inventarioBinding(Queue inventarioQueue, DirectExchange pedidosExchange) {
        return BindingBuilder.bind(inventarioQueue).to(pedidosExchange).with(INVENTARIO_ROUTING_KEY);
    }

    @Bean
    public Queue inventarioDlq() {
        return QueueBuilder.durable(INVENTARIO_DLQ)
                .withArgument("x-message-ttl", 86400000)
                .build();
    }

    @Bean
    public Binding inventarioDlqBinding(Queue inventarioDlq, DirectExchange deadLetterExchange) {
        return BindingBuilder.bind(inventarioDlq).to(deadLetterExchange).with(INVENTARIO_DLQ_KEY);
    }
}