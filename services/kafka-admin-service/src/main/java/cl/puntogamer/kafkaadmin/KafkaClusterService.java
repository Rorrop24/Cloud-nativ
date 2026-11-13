package cl.puntogamer.kafkaadmin;

import cl.puntogamer.streaming.StreamPublisher;
import cl.puntogamer.streaming.StreamingProperties;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.apache.kafka.clients.admin.Admin;
import org.apache.kafka.clients.admin.AdminClientConfig;
import org.apache.kafka.clients.admin.ConsumerGroupDescription;
import org.apache.kafka.clients.admin.ConsumerGroupListing;
import org.apache.kafka.clients.admin.ListOffsetsResult;
import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.clients.admin.OffsetSpec;
import org.apache.kafka.clients.admin.TopicDescription;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.clients.consumer.OffsetAndMetadata;
import org.apache.kafka.common.KafkaFuture;
import org.apache.kafka.common.Node;
import org.apache.kafka.common.PartitionInfo;
import org.apache.kafka.common.TopicPartition;
import org.apache.kafka.common.TopicPartitionInfo;
import org.apache.kafka.common.errors.TopicExistsException;
import org.apache.kafka.common.errors.UnknownTopicOrPartitionException;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.kafka.support.SendResult;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/** Operaciones administrativas sobre el cluster mediante el AdminClient oficial de Kafka. */
@Service
public class KafkaClusterService {
    private static final Logger log = LoggerFactory.getLogger(KafkaClusterService.class);
    private static final long TIMEOUT_SECONDS = 8;
    private final StreamingProperties properties;
    private final StreamPublisher publisher;
    private Admin admin;

    public KafkaClusterService(StreamingProperties properties, StreamPublisher publisher) {
        this.properties = properties;
        this.publisher = publisher;
    }

    /** El cliente se crea al primer uso: el servicio arranca aunque los brokers aun no respondan. */
    private synchronized Admin admin() {
        if (admin == null) {
            Map<String, Object> config = new HashMap<>();
            config.put(AdminClientConfig.BOOTSTRAP_SERVERS_CONFIG, properties.bootstrapServers());
            config.put(AdminClientConfig.REQUEST_TIMEOUT_MS_CONFIG, 5000);
            config.put(AdminClientConfig.DEFAULT_API_TIMEOUT_MS_CONFIG, 8000);
            config.put(AdminClientConfig.CLIENT_ID_CONFIG, "kafka-admin-service");
            try {
                admin = Admin.create(config);
            } catch (RuntimeException error) {
                throw unavailable(error);
            }
        }
        return admin;
    }

    @jakarta.annotation.PreDestroy
    public synchronized void close() {
        if (admin != null) {
            admin.close(Duration.ofSeconds(5));
            admin = null;
        }
    }

    /** Cantidad de brokers vivos; 0 si el cluster no responde. Lo usa /health. */
    public int brokerCount() {
        try {
            return admin().describeCluster().nodes().get(3, TimeUnit.SECONDS).size();
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            return 0;
        } catch (ExecutionException | TimeoutException | RuntimeException error) {
            return 0;
        }
    }

    public Map<String, Object> cluster() {
        var description = admin().describeCluster();
        Collection<Node> nodes = await(description.nodes());
        Node controller = await(description.controller());
        List<Map<String, Object>> brokers = nodes.stream().sorted(Comparator.comparingInt(Node::id))
                .map(node -> {
                    Map<String, Object> broker = new LinkedHashMap<>();
                    broker.put("id", node.id());
                    broker.put("host", node.host());
                    broker.put("port", node.port());
                    broker.put("controller", controller != null && controller.id() == node.id());
                    return broker;
                }).toList();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("clusterId", await(description.clusterId()));
        result.put("brokers", brokers);
        result.put("brokerCount", brokers.size());
        return result;
    }

    public List<Map<String, Object>> topics() {
        Set<String> names = new TreeSet<>(await(admin().listTopics().names()));
        if (names.isEmpty()) {
            return List.of();
        }
        Map<String, TopicDescription> descriptions = await(admin().describeTopics(names).allTopicNames());
        Map<TopicPartition, OffsetSpec> latest = new HashMap<>();
        Map<TopicPartition, OffsetSpec> earliest = new HashMap<>();
        for (TopicDescription description : descriptions.values()) {
            for (TopicPartitionInfo partition : description.partitions()) {
                TopicPartition key = new TopicPartition(description.name(), partition.partition());
                latest.put(key, OffsetSpec.latest());
                earliest.put(key, OffsetSpec.earliest());
            }
        }
        Map<TopicPartition, ListOffsetsResult.ListOffsetsResultInfo> ends = await(admin().listOffsets(latest).all());
        Map<TopicPartition, ListOffsetsResult.ListOffsetsResultInfo> starts = await(admin().listOffsets(earliest).all());
        List<Map<String, Object>> result = new ArrayList<>();
        for (String name : names) {
            TopicDescription description = descriptions.get(name);
            if (description == null) {
                continue;
            }
            long messages = 0;
            int replicas = 0;
            int inSync = Integer.MAX_VALUE;
            for (TopicPartitionInfo partition : description.partitions()) {
                TopicPartition key = new TopicPartition(name, partition.partition());
                if (ends.containsKey(key) && starts.containsKey(key)) {
                    messages += Math.max(0, ends.get(key).offset() - starts.get(key).offset());
                }
                replicas = Math.max(replicas, partition.replicas().size());
                inSync = Math.min(inSync, partition.isr().size());
            }
            Map<String, Object> topic = new LinkedHashMap<>();
            topic.put("name", name);
            topic.put("partitions", description.partitions().size());
            topic.put("replicationFactor", replicas);
            topic.put("minInSyncReplicas", inSync == Integer.MAX_VALUE ? 0 : inSync);
            topic.put("messages", messages);
            topic.put("project", properties.topics().all().contains(name));
            topic.put("deadLetter", properties.topics().isDeadLetter(name));
            result.add(topic);
        }
        return result;
    }

    public Map<String, Object> topic(String name) {
        Map<String, TopicDescription> descriptions = await(admin().describeTopics(List.of(name)).allTopicNames());
        TopicDescription description = descriptions.get(name);
        if (description == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Topic no encontrado");
        }
        List<Map<String, Object>> partitions = description.partitions().stream().map(partition -> {
            Map<String, Object> detail = new LinkedHashMap<>();
            detail.put("partition", partition.partition());
            detail.put("leader", partition.leader() == null ? null : partition.leader().id());
            detail.put("replicas", partition.replicas().stream().map(Node::id).toList());
            detail.put("inSyncReplicas", partition.isr().stream().map(Node::id).toList());
            return detail;
        }).toList();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("name", name);
        result.put("partitions", partitions);
        return result;
    }

    public void createTopic(Requests.TopicRequest request) {
        await(admin().createTopics(List.of(new NewTopic(request.name(), request.partitionCount(), request.replicas()))).all());
        log.info("[KAFKA ADMIN] topic creado name={} particiones={} replicas={}", request.name(),
                request.partitionCount(), request.replicas());
    }

    public void deleteTopic(String name) {
        if (properties.topics().all().contains(name)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "No se elimina un topic de negocio");
        }
        await(admin().deleteTopics(List.of(name)).all());
        log.info("[KAFKA ADMIN] topic eliminado name={}", name);
    }

    public List<Map<String, Object>> consumerGroups() {
        List<String> ids = await(admin().listConsumerGroups().all()).stream()
                .map(ConsumerGroupListing::groupId).sorted().toList();
        if (ids.isEmpty()) {
            return List.of();
        }
        Map<String, ConsumerGroupDescription> descriptions = await(admin().describeConsumerGroups(ids).all());
        List<Map<String, Object>> result = new ArrayList<>();
        for (String id : ids) {
            Map<TopicPartition, OffsetAndMetadata> committed =
                    await(admin().listConsumerGroupOffsets(id).partitionsToOffsetAndMetadata());
            Map<TopicPartition, OffsetSpec> request = new HashMap<>();
            committed.forEach((partition, offset) -> {
                if (offset != null) {
                    request.put(partition, OffsetSpec.latest());
                }
            });
            Map<TopicPartition, ListOffsetsResult.ListOffsetsResultInfo> ends =
                    request.isEmpty() ? Map.of() : await(admin().listOffsets(request).all());
            Map<String, Long> lagByTopic = new TreeMap<>();
            long lag = 0;
            for (Map.Entry<TopicPartition, ListOffsetsResult.ListOffsetsResultInfo> end : ends.entrySet()) {
                long pending = Math.max(0, end.getValue().offset() - committed.get(end.getKey()).offset());
                lag += pending;
                lagByTopic.merge(end.getKey().topic(), pending, Long::sum);
            }
            ConsumerGroupDescription description = descriptions.get(id);
            Map<String, Object> group = new LinkedHashMap<>();
            group.put("groupId", id);
            group.put("state", description == null ? "UNKNOWN" : String.valueOf(description.state()));
            group.put("members", description == null ? 0 : description.members().size());
            group.put("lag", lag);
            group.put("lagByTopic", lagByTopic);
            result.add(group);
        }
        return result;
    }

    /** Ultimos mensajes de un topic, sin grupo ni commits: no altera a los consumidores reales. */
    public List<Map<String, Object>> messages(String topic, int limit) {
        Properties config = new Properties();
        config.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, properties.bootstrapServers());
        config.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());
        config.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());
        config.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, "false");
        config.put(ConsumerConfig.REQUEST_TIMEOUT_MS_CONFIG, "5000");
        config.put(ConsumerConfig.DEFAULT_API_TIMEOUT_MS_CONFIG, "8000");
        config.put(ConsumerConfig.CLIENT_ID_CONFIG, "kafka-admin-service-reader");
        List<Map<String, Object>> result = new ArrayList<>();
        try (KafkaConsumer<String, String> consumer = new KafkaConsumer<>(config)) {
            List<PartitionInfo> infos = consumer.partitionsFor(topic, Duration.ofSeconds(TIMEOUT_SECONDS));
            if (infos == null || infos.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Topic no encontrado");
            }
            List<TopicPartition> partitions = infos.stream()
                    .map(info -> new TopicPartition(info.topic(), info.partition())).toList();
            consumer.assign(partitions);
            Map<TopicPartition, Long> starts = consumer.beginningOffsets(partitions, Duration.ofSeconds(TIMEOUT_SECONDS));
            Map<TopicPartition, Long> ends = consumer.endOffsets(partitions, Duration.ofSeconds(TIMEOUT_SECONDS));
            long pending = 0;
            for (TopicPartition partition : partitions) {
                long from = Math.max(starts.get(partition), ends.get(partition) - limit);
                consumer.seek(partition, from);
                pending += ends.get(partition) - from;
            }
            long deadline = System.currentTimeMillis() + 6000;
            while (pending > 0 && System.currentTimeMillis() < deadline) {
                for (ConsumerRecord<String, String> record : consumer.poll(Duration.ofMillis(500))) {
                    if (record.offset() >= ends.get(new TopicPartition(record.topic(), record.partition()))) {
                        continue;
                    }
                    pending--;
                    Map<String, Object> message = new LinkedHashMap<>();
                    message.put("partition", record.partition());
                    message.put("offset", record.offset());
                    message.put("timestamp", Instant.ofEpochMilli(record.timestamp()).toString());
                    message.put("key", record.key());
                    message.put("value", record.value());
                    result.add(message);
                }
            }
        } catch (ResponseStatusException error) {
            throw error;
        } catch (RuntimeException error) {
            throw unavailable(error);
        }
        result.sort(Comparator.comparing((Map<String, Object> message) -> String.valueOf(message.get("timestamp"))).reversed());
        return result.size() > limit ? result.subList(0, limit) : result;
    }

    public Map<String, Object> publish(Requests.EventRequest request) {
        String key = request.key() == null || request.key().isBlank() ? "prueba-" + System.currentTimeMillis() : request.key();
        try {
            SendResult<String, String> sent = publisher.publishRaw(request.topic(), key, request.message())
                    .get(15, TimeUnit.SECONDS);
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("topic", sent.getRecordMetadata().topic());
            result.put("partition", sent.getRecordMetadata().partition());
            result.put("offset", sent.getRecordMetadata().offset());
            result.put("key", key);
            result.put("acknowledged", true);
            return result;
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw unavailable(error);
        } catch (ExecutionException | TimeoutException | RuntimeException error) {
            throw unavailable(error);
        }
    }

    private <T> T await(KafkaFuture<T> future) {
        try {
            return future.get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw unavailable(error);
        } catch (ExecutionException error) {
            if (error.getCause() instanceof TopicExistsException) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "El topic ya existe");
            }
            if (error.getCause() instanceof UnknownTopicOrPartitionException) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Topic no encontrado");
            }
            if (error.getCause() instanceof org.apache.kafka.common.errors.InvalidReplicationFactorException) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Replicas mayores que los brokers disponibles");
            }
            throw unavailable(error);
        } catch (TimeoutException error) {
            throw unavailable(error);
        }
    }

    private ResponseStatusException unavailable(Exception error) {
        log.warn("[KAFKA ADMIN] cluster no disponible: {}", error.toString());
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Kafka no esta disponible");
    }
}
