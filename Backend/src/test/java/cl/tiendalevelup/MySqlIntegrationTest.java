package cl.tiendalevelup;

import cl.tiendalevelup.Entity.Producto;
import cl.tiendalevelup.Entity.Resenia;
import cl.tiendalevelup.Entity.Usuario;
import cl.tiendalevelup.Repository.ProductoRepository;
import cl.tiendalevelup.Repository.ReseniaRepository;
import cl.tiendalevelup.Repository.UsuarioRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;

@Testcontainers(disabledWithoutDocker = true)
@DataJpaTest(properties = {
        "spring.datasource.driver-class-name=com.mysql.cj.jdbc.Driver",
        "spring.jpa.database-platform=org.hibernate.dialect.MySQLDialect",
        "spring.jpa.hibernate.ddl-auto=validate",
        "spring.flyway.enabled=true",
        "spring.flyway.locations=classpath:db/mysql"
})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class MySqlIntegrationTest {
    @Container
    static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4")
            .withDatabaseName("punto_gamer");

    @DynamicPropertySource
    static void connection(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
        registry.add("spring.datasource.username", MYSQL::getUsername);
        registry.add("spring.datasource.password", MYSQL::getPassword);
    }

    @Autowired private JdbcTemplate jdbc;
    @Autowired private ProductoRepository productos;
    @Autowired private UsuarioRepository usuarios;
    @Autowired private ReseniaRepository resenias;
    @Autowired private EntityManager entityManager;

    @Test
    void longReviewTextRoundTripsOnActualMySql() {
        Usuario usuario = new Usuario();
        usuario.setNombre("Persona"); usuario.setApellido("Prueba");
        usuario.setRut("12345678-9"); usuario.setEmail("mysql-review@example.test");
        usuario.setPassword("not-a-login-password"); usuario.setFechaNacimiento("2000-01-01");
        usuario.setRegion("Metropolitana"); usuario.setComuna("Santiago");
        usuario.setTelefono("123456789"); usuario.setRol("USER");
        usuarios.saveAndFlush(usuario);
        Producto producto = new Producto();
        producto.setId("MYSQL-TEXT"); producto.setNombre("Prueba de texto");
        producto.setPrecio(1000); producto.setStock(1);
        productos.saveAndFlush(producto);
        Resenia resenia = new Resenia();
        resenia.setUsuario(usuario); resenia.setProducto(producto);
        resenia.setTexto("Reseña extensa ñ ".repeat(500)); resenia.setCalificacion(5);
        String expected = resenia.getTexto();
        Long id = resenias.saveAndFlush(resenia).getId();
        entityManager.clear();
        assertThat(resenias.findById(id).orElseThrow().getTexto()).isEqualTo(expected);
    }

    @Test
    void flywaySchemaIsValidatedAgainstActualMySql() {
        assertThat(jdbc.queryForObject("SELECT VERSION()", String.class)).startsWith("8.4.");
        assertThat(jdbc.queryForObject(
                "SELECT COUNT(*) FROM flyway_schema_history WHERE version = '1' AND success = TRUE",
                Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject(
                "SELECT DATA_TYPE FROM information_schema.columns WHERE table_schema = DATABASE() "
                        + "AND table_name = 'resenias' AND column_name = 'texto'",
                String.class)).isEqualTo("longtext");
    }

    @Test
    void stockQueryRunsOnActualMySql() {
        Producto producto = new Producto();
        producto.setId("MYSQL-1");
        producto.setNombre("Prueba MySQL");
        producto.setPrecio(1000);
        producto.setStock(2);
        productos.saveAndFlush(producto);
        assertThat(productos.descontarStockAtomicamente("MYSQL-1", 2)).isEqualTo(1);
        assertThat(productos.descontarStockAtomicamente("MYSQL-1", 1)).isZero();
    }
}
