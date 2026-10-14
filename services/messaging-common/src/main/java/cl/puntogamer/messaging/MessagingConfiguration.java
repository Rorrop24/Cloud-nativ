package cl.puntogamer.messaging;
import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
@Configuration
@EnableScheduling
@Import(ApiErrors.class)
@PropertySource("classpath:messaging-defaults.properties")
@EnableConfigurationProperties(MessagingProperties.class)
public class MessagingConfiguration {
    @Bean public Jackson2JsonMessageConverter jsonMessageConverter() { return new Jackson2JsonMessageConverter(); }
    @Bean public DirectExchange pedidosExchange(MessagingProperties p) { return new DirectExchange(p.exchange(), true, false); }
    @Bean public DirectExchange deadLetterExchange(MessagingProperties p) { return new DirectExchange(p.deadLetterExchange(), true, false); }
    private Queue mainQueue(MessagingProperties p, MessagingProperties.Route route, boolean bounded) {
        var builder = QueueBuilder.durable(route.queue()).withArgument("x-message-ttl", route.ttl())
            .withArgument("x-dead-letter-exchange", p.deadLetterExchange()).withArgument("x-dead-letter-routing-key", route.deadLetterRoutingKey());
        if (bounded) builder.withArgument("x-max-length", 1000);
        return builder.build();
    }
    private Queue dlq(MessagingProperties p, MessagingProperties.Route route) { return QueueBuilder.durable(route.dlq()).withArgument("x-message-ttl", p.dlqTtl()).build(); }
    @Bean public Queue pedidosQueue(MessagingProperties p) { return mainQueue(p, p.pedidos(), true); }
    @Bean public Queue inventarioQueue(MessagingProperties p) { return mainQueue(p, p.inventario(), false); }
    @Bean public Queue notificacionesQueue(MessagingProperties p) { return mainQueue(p, p.notificaciones(), false); }
    @Bean public Queue pedidosDlq(MessagingProperties p) { return dlq(p, p.pedidos()); }
    @Bean public Queue inventarioDlq(MessagingProperties p) { return dlq(p, p.inventario()); }
    @Bean public Queue notificacionesDlq(MessagingProperties p) { return dlq(p, p.notificaciones()); }
    @Bean public Binding pedidosBinding(@Qualifier("pedidosQueue") Queue q, @Qualifier("pedidosExchange") DirectExchange e, MessagingProperties p) { return BindingBuilder.bind(q).to(e).with(p.pedidos().routingKey()); }
    @Bean public Binding inventarioBinding(@Qualifier("inventarioQueue") Queue q, @Qualifier("pedidosExchange") DirectExchange e, MessagingProperties p) { return BindingBuilder.bind(q).to(e).with(p.inventario().routingKey()); }
    @Bean public Binding notificacionesBinding(@Qualifier("notificacionesQueue") Queue q, @Qualifier("pedidosExchange") DirectExchange e, MessagingProperties p) { return BindingBuilder.bind(q).to(e).with(p.notificaciones().routingKey()); }
    @Bean public Binding pedidosDlqBinding(@Qualifier("pedidosDlq") Queue q, @Qualifier("deadLetterExchange") DirectExchange e, MessagingProperties p) { return BindingBuilder.bind(q).to(e).with(p.pedidos().deadLetterRoutingKey()); }
    @Bean public Binding inventarioDlqBinding(@Qualifier("inventarioDlq") Queue q, @Qualifier("deadLetterExchange") DirectExchange e, MessagingProperties p) { return BindingBuilder.bind(q).to(e).with(p.inventario().deadLetterRoutingKey()); }
    @Bean public Binding notificacionesDlqBinding(@Qualifier("notificacionesDlq") Queue q, @Qualifier("deadLetterExchange") DirectExchange e, MessagingProperties p) { return BindingBuilder.bind(q).to(e).with(p.notificaciones().deadLetterRoutingKey()); }
    @Bean public ConfirmedPublisher confirmedPublisher(RabbitTemplate template) { return new ConfirmedPublisher(template); }
    @Bean public ManualAcknowledgement manualAcknowledgement(MessagingProperties p, ConfirmedPublisher publisher) { return new ManualAcknowledgement(p, publisher); }
    @Bean public EventStore eventStore(JdbcTemplate jdbc, PlatformTransactionManager manager) { return new EventStore(jdbc, new TransactionTemplate(manager)); }
    @Bean public Outbox outbox(JdbcTemplate jdbc, PlatformTransactionManager manager, ConfirmedPublisher publisher,
            @Value("${spring.application.name:punto-gamer}") String producer) { return new Outbox(jdbc, new TransactionTemplate(manager), publisher, producer); }
    @Bean @ConditionalOnProperty(name="app.outbox.enabled", havingValue="true", matchIfMissing=true)
    public OutboxDispatcher outboxDispatcher(Outbox outbox) { return new OutboxDispatcher(outbox); }
}
