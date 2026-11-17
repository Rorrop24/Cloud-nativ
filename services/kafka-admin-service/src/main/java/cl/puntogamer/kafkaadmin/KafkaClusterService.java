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
import org.apache.kafka.clients.admin.AlterConfigOp;
import org.apache.kafka.clients.admin.Config;
import org.apache.kafka.clients.admin.ConfigEntry;
import org.apache.kafka.clients.admin.ConsumerGroupDescription;
import org.apache.kafka.clients.admin.ConsumerGroupListing;
import org.apache.kafka.clients.admin.ListOffsetsResult;
import org.apache.kafka.clients.admin.MemberDescription;
import org.apache.kafka.clients.admin.NewPartitions;
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
import org.apache.kafka.common.config.ConfigResource;
import org.apache.kafka.common.errors.GroupIdNotFoundException;
import org.apache.kafka.common.errors.InvalidConfigurationException;
import org.apache.kafka.common.errors.InvalidPartitionsException;
import org.apache.kafka.common.errors.InvalidReplicationFactorException;
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

    // ---------------------------------------------------------------- topics

    public List<Map<String, Object>> topics() {
        Set<String> names = new TreeSet<>(await(admin().listTopics().names()));
        if (names.isEmpty()) {
            return List.of();
        }
        Map<String, TopicDescription> descriptions = await(admin().describeTopics(names).allTopicNames());
        Map<String, Config> configs = configs(names);
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
            Config config = configs.get(name);
            Map<String, Object> topic = new LinkedHashMap<>();
            topic.put("name", name);
            topic.put("partitions", description.partitions().size());
            topic.put("replicationFactor", replicas);
            topic.put("inSyncReplicas", inSync == Integer.MAX_VALUE ? 0 : inSync);
            topic.put("retentionMs", value(config, "retention.ms"));
            topic.put("cleanupPolicy", value(config, "cleanup.policy"));
            topic.put("minInsyncReplicas", value(config, "min.insync.replicas"));
            topic.put("messages", messages);
            topic.put("project", properties.topics().all().contains(name));
            topic.put("deadLetter", properties.topics().isDeadLetter(name));
            result.add(topic);
        }
        return result;
    }

    public Map<String, Object> topic(String name) {
        TopicDescription description = describe(name);
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
        result.put("config", topicConfig(name).get("config"));
        return result;
    }

    public void createTopic(Requests.TopicRequest request) {
        NewTopic topic = new NewTopic(request.name(), request.partitionCount(), request.replicas()).configs(request.configs());
        await(admin().createTopics(List.of(topic)).all());
        log.info("[KAFKA ADMIN] topic creado name={} particiones={} replicas={} config={}", request.name(),
                request.partitionCount(), request.replicas(), request.configs());
    }

    public void deleteTopic(String name) {
        if (properties.topics().all().contains(name)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "No se elimina un topic de negocio");
        }
        await(admin().deleteTopics(List.of(name)).all());
        log.info("[KAFKA ADMIN] topic eliminado name={}", name);
    }

    /** Configuracion editable del topic, con su origen (por defecto, broker o propia del topic). */
    public Map<String, Object> topicConfig(String name) {
        Config config = configs(Set.of(name)).get(name);
        if (config == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Topic no encontrado");
        }
        Map<String, Object> entries = new TreeMap<>();
        for (String key : Requests.EDITABLE_CONFIGS) {
            ConfigEntry entry = config.get(key);
            if (entry != null) {
                entries.put(key, Map.of("value", String.valueOf(entry.value()), "source", String.valueOf(entry.source())));
            }
        }
        Map<String, String> declared = properties.topicConfigs().get(name);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("name", name);
        result.put("config", entries);
        result.put("declared", declared == null ? Map.of() : declared);
        return result;
    }

    /** Cambia propiedades del topic con incrementalAlterConfigs (solo las indicadas). */
    public Map<String, Object> updateTopicConfig(String name, Map<String, String> changes) {
        describe(name);
        ConfigResource resource = new ConfigResource(ConfigResource.Type.TOPIC, name);
        List<AlterConfigOp> operations = changes.entrySet().stream()
                .map(change -> new AlterConfigOp(new ConfigEntry(change.getKey(), change.getValue()), AlterConfigOp.OpType.SET))
                .toList();
        await(admin().incrementalAlterConfigs(Map.of(resource, operations)).all());
        log.info("[KAFKA ADMIN] configuracion actualizada topic={} cambios={}", name, changes);
        return topicConfig(name);
    }

    /** Vuelve una propiedad al valor por defecto del broker. */
    public Map<String, Object> resetTopicConfig(String name, String key) {
        if (!Requests.EDITABLE_CONFIGS.contains(key)) {
            throw new IllegalArgumentException("Propiedad no editable: " + key);
        }
        describe(name);
        ConfigResource resource = new ConfigResource(ConfigResource.Type.TOPIC, name);
        AlterConfigOp operation = new AlterConfigOp(new ConfigEntry(key, ""), AlterConfigOp.OpType.DELETE);
        await(admin().incrementalAlterConfigs(Map.of(resource, List.of(operation))).all());
        log.info("[KAFKA ADMIN] configuracion restablecida topic={} propiedad={}", name, key);
        return topicConfig(name);
    }

    /** Aumenta particiones. Kafka no permite reducirlas sin recrear el topic. */
    public Map<String, Object> increasePartitions(String name, int count) {
        int current = describe(name).partitions().size();
        if (count <= current) {
            throw new IllegalArgumentException("El topic ya tiene " + current + " particiones; solo se pueden aumentar");
        }
        await(admin().createPartitions(Map.of(name, NewPartitions.increaseTo(count))).all());
        log.info("[KAFKA ADMIN] particiones aumentadas topic={} de={} a={}", name, current, count);
        return Map.of("name", name, "previous", current, "partitions", count);
    }

    /**
     * Aplica a los seis topics del proyecto la configuracion de kafka-defaults.properties.
     * Corrige topics creados antes o modificados a mano. Es idempotente.
     */
    public List<Map<String, Object>> applyDeclaredConfigs() {
        Map<String, Map<String, String>> declared = properties.topicConfigs();
        Set<String> existing = await(admin().listTopics().names());
        Map<ConfigResource, Collection<AlterConfigOp>> operations = new LinkedHashMap<>();
        List<Map<String, Object>> result = new ArrayList<>();
        declared.forEach((topic, configs) -> {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("topic", topic);
            if (!existing.contains(topic)) {
                entry.put("status", "NO_EXISTE");
            } else {
                operations.put(new ConfigResource(ConfigResource.Type.TOPIC, topic), configs.entrySet().stream()
                        .map(c -> new AlterConfigOp(new ConfigEntry(c.getKey(), c.getValue()), AlterConfigOp.OpType.SET))
                        .toList());
                entry.put("status", "APLICADA");
                entry.put("config", configs);
            }
            result.add(entry);
        });
        if (!operations.isEmpty()) {
            await(admin().incrementalAlterConfigs(operations).all());
        }
        log.info("[KAFKA ADMIN] configuracion declarada aplicada a {} topics", operations.size());
        return result;
    }

    // ---------------------------------------------------------- consumer groups

    public List<Map<String, Object>> consumerGroups() {
        List<String> ids = await(admin().listConsumerGroups().all()).stream()
                .map(ConsumerGroupListing::groupId).sorted().toList();
        if (ids.isEmpty()) {
            return List.of();
        }
        Map<String, ConsumerGroupDescription> descriptions = await(admin().describeConsumerGroups(ids).all());
        List<Map<String, Object>> result = new ArrayList<>();
        for (String id : ids) {
            Map<TopicPartition, Long> lags = lag(id);
            Map<String, Long> lagByTopic = new TreeMap<>();
            lags.forEach((partition, pending) -> lagByTopic.merge(partition.topic(), pending, Long::sum));
            ConsumerGroupDescription description = descriptions.get(id);
            Map<String, Object> group = new LinkedHashMap<>();
            group.put("groupId", id);
            group.put("state", description == null ? "UNKNOWN" : String.valueOf(description.state()));
            group.put("members", description == null ? 0 : description.members().size());
            group.put("lag", lags.values().stream().mapToLong(Long::longValue).sum());
            group.put("lagByTopic", lagByTopic);
            result.add(group);
        }
        return result;
    }

    /** Miembros del grupo y las particiones que tiene cada uno: muestra el balanceo de carga. */
    public Map<String, Object> consumerGroup(String id) {
        ConsumerGroupDescription description = await(admin().describeConsumerGroups(List.of(id)).all()).get(id);
        if (description == null || "dead".equalsIgnoreCase(String.valueOf(description.state()))) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Consumer group no encontrado");
        }
        Map<TopicPartition, Long> lags = lag(id);
        Map<TopicPartition, OffsetAndMetadata> committed = await(admin().listConsumerGroupOffsets(id).partitionsToOffsetAndMetadata());
        List<Map<String, Object>> members = new ArrayList<>();
        for (MemberDescription member : description.members()) {
            List<String> assigned = member.assignment().topicPartitions().stream()
                    .sorted(Comparator.comparing(TopicPartition::topic).thenComparingInt(TopicPartition::partition))
                    .map(TopicPartition::toString).toList();
            Map<String, Object> detail = new LinkedHashMap<>();
            detail.put("clientId", member.clientId());
            detail.put("host", member.host());
            detail.put("partitions", assigned);
            members.add(detail);
        }
        List<Map<String, Object>> partitions = new ArrayList<>();
        committed.entrySet().stream()
                .sorted(Map.Entry.comparingByKey(Comparator.comparing(TopicPartition::topic).thenComparingInt(TopicPartition::partition)))
                .forEach(entry -> {
                    Map<String, Object> detail = new LinkedHashMap<>();
                    detail.put("partition", entry.getKey().toString());
                    detail.put("committedOffset", entry.getValue() == null ? null : entry.getValue().offset());
                    detail.put("lag", lags.getOrDefault(entry.getKey(), 0L));
                    partitions.add(detail);
                });
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("groupId", id);
        result.put("state", String.valueOf(description.state()));
        result.put("assignor", description.partitionAssignor());
        result.put("members", members);
        result.put("partitions", partitions);
        return result;
    }

    /**
     * Mueve los offsets del grupo al inicio o al final de cada particion. Kafka solo lo
     * permite con el grupo vacio, para no pisar a consumidores que estan leyendo.
     */
    public Map<String, Object> resetGroupOffsets(String id, String to) {
        ConsumerGroupDescription description = await(admin().describeConsumerGroups(List.of(id)).all()).get(id);
        String state = description == null ? "dead" : String.valueOf(description.state()).toLowerCase();
        if (!state.equals("empty")) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "El grupo tiene consumidores activos (" + state + "); detenerlos antes de mover offsets");
        }
        Map<TopicPartition, OffsetAndMetadata> committed = await(admin().listConsumerGroupOffsets(id).partitionsToOffsetAndMetadata());
        if (committed.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "El grupo no tiene offsets confirmados");
        }
        Map<TopicPartition, OffsetSpec> request = new HashMap<>();
        committed.keySet().forEach(partition -> request.put(partition, to.equals("earliest") ? OffsetSpec.earliest() : OffsetSpec.latest()));
        Map<TopicPartition, ListOffsetsResult.ListOffsetsResultInfo> targets = await(admin().listOffsets(request).all());
        Map<TopicPartition, OffsetAndMetadata> offsets = new HashMap<>();
        targets.forEach((partition, info) -> offsets.put(partition, new OffsetAndMetadata(info.offset())));
        await(admin().alterConsumerGroupOffsets(id, offsets).all());
        log.info("[KAFKA ADMIN] offsets del grupo {} movidos a {} en {} particiones", id, to, offsets.size());
        return Map.of("groupId", id, "to", to, "partitions", offsets.size());
    }

    // ---------------------------------------------------------- mensajes

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
            SendResult<String, Object> sent = publisher.publishRaw(request.topic(), key, request.message())
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

    // ---------------------------------------------------------- utilidades

    private TopicDescription describe(String name) {
        TopicDescription description = await(admin().describeTopics(List.of(name)).allTopicNames()).get(name);
        if (description == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Topic no encontrado");
        }
        return description;
    }

    private Map<String, Config> configs(Set<String> names) {
        List<ConfigResource> resources = names.stream()
                .map(name -> new ConfigResource(ConfigResource.Type.TOPIC, name)).toList();
        Map<ConfigResource, Config> configs = await(admin().describeConfigs(resources).all());
        Map<String, Config> result = new HashMap<>();
        configs.forEach((resource, config) -> result.put(resource.name(), config));
        return result;
    }

    private static String value(Config config, String key) {
        ConfigEntry entry = config == null ? null : config.get(key);
        return entry == null ? null : entry.value();
    }

    /** Lag por particion: ultimo offset del topic menos el offset confirmado por el grupo. */
    private Map<TopicPartition, Long> lag(String groupId) {
        Map<TopicPartition, OffsetAndMetadata> committed =
                await(admin().listConsumerGroupOffsets(groupId).partitionsToOffsetAndMetadata());
        Map<TopicPartition, OffsetSpec> request = new HashMap<>();
        committed.forEach((partition, offset) -> {
            if (offset != null) {
                request.put(partition, OffsetSpec.latest());
            }
        });
        if (request.isEmpty()) {
            return Map.of();
        }
        Map<TopicPartition, ListOffsetsResult.ListOffsetsResultInfo> ends = await(admin().listOffsets(request).all());
        Map<TopicPartition, Long> lags = new HashMap<>();
        ends.forEach((partition, end) -> lags.put(partition, Math.max(0, end.offset() - committed.get(partition).offset())));
        return lags;
    }

    private <T> T await(KafkaFuture<T> future) {
        try {
            return future.get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw unavailable(error);
        } catch (ExecutionException error) {
            Throwable cause = error.getCause();
            if (cause instanceof TopicExistsException) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "El topic ya existe");
            }
            if (cause instanceof UnknownTopicOrPartitionException) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Topic no encontrado");
            }
            if (cause instanceof GroupIdNotFoundException) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Consumer group no encontrado");
            }
            if (cause instanceof InvalidReplicationFactorException) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Replicas mayores que los brokers disponibles");
            }
            if (cause instanceof InvalidConfigurationException || cause instanceof InvalidPartitionsException) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Kafka rechazo el cambio: " + cause.getMessage());
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
