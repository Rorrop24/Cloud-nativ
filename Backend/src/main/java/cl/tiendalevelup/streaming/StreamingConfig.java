package cl.tiendalevelup.streaming;

import cl.puntogamer.streaming.StreamingConfiguration;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Profile;

/** Activa el productor Kafka compartido solo cuando el perfil "streaming" esta presente. */
@Configuration
@Profile("streaming")
@Import(StreamingConfiguration.class)
public class StreamingConfig {
}
