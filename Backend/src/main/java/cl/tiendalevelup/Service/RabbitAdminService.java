package cl.tiendalevelup.Service;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.core.QueueInformation;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitAdmin;
import org.springframework.stereotype.Service;

@Service
public class RabbitAdminService {

    private final RabbitAdmin rabbitAdmin;

    public RabbitAdminService(ConnectionFactory connectionFactory) {
        this.rabbitAdmin = new RabbitAdmin(connectionFactory);
    }

    public void createQueue(String queueName, boolean durable) {
        Queue queue = durable ? QueueBuilder.durable(queueName).build() : QueueBuilder.nonDurable(queueName).build();
        rabbitAdmin.declareQueue(queue);
    }

    public void createExchange(String exchangeName) {
        DirectExchange exchange = new DirectExchange(exchangeName, true, false);
        rabbitAdmin.declareExchange(exchange);
    }

    public void createBinding(String queueName, String exchangeName, String routingKey) {
        Binding binding = BindingBuilder.bind(new Queue(queueName))
                .to(new DirectExchange(exchangeName))
                .with(routingKey);
        rabbitAdmin.declareBinding(binding);
    }

    public QueueInformation getQueueInfo(String queueName) {
        return rabbitAdmin.getQueueInfo(queueName);
    }

    public boolean deleteQueue(String queueName) {
        return rabbitAdmin.deleteQueue(queueName);
    }

    public int purgeQueue(String queueName) {
        return rabbitAdmin.purgeQueue(queueName);
    }
}