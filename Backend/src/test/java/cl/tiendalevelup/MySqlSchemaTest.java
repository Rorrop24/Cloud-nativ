package cl.tiendalevelup;

import cl.tiendalevelup.Entity.Categoria;
import cl.tiendalevelup.Entity.Producto;
import cl.tiendalevelup.Entity.Resenia;
import cl.tiendalevelup.Entity.Usuario;
import cl.tiendalevelup.Repository.CategoriaRepository;
import cl.tiendalevelup.Repository.ProductoRepository;
import cl.tiendalevelup.Repository.ReseniaRepository;
import cl.tiendalevelup.Repository.UsuarioRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:mysql-schema;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.jpa.hibernate.ddl-auto=none",
        "spring.flyway.enabled=true",
        "spring.flyway.locations=classpath:db/mysql"
})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class MySqlSchemaTest {
    @Autowired private ProductoRepository productos;
    @Autowired private CategoriaRepository categorias;
    @Autowired private UsuarioRepository usuarios;
    @Autowired private ReseniaRepository resenias;
    @Autowired private EntityManager entityManager;
    @Autowired private JdbcTemplate jdbc;

    @Test
    void migrationCreatesSchemaWithoutHibernateUpdates() {
        assertThat(jdbc.queryForObject(
                "SELECT COUNT(*) FROM flyway_schema_history WHERE version = '1' AND success = TRUE",
                Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM boletas", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM imagenes", Integer.class)).isZero();
    }

    @Test
    void featuredQueryIsPortableAndLimitedToThree() {
        Categoria categoria = new Categoria();
        categoria.setNombre("Teclados");
        categorias.save(categoria);
        for (int i = 1; i <= 4; i++) {
            Producto producto = producto("AWS-" + i);
            producto.setCategoria(categoria);
            producto.setDestacado(true);
            producto.getDetalles().put("layout", "ES");
            productos.save(producto);
        }
        productos.flush();
        entityManager.clear();

        assertThat(productos.findTop3ByDestacadoTrueOrderByIdAsc())
                .extracting(Producto::getId).containsExactly("AWS-1", "AWS-2", "AWS-3");
        assertThat(productos.findById("AWS-1").orElseThrow().getDetalles()).containsEntry("layout", "ES");
    }

    @Test
    void atomicStockUpdateCannotMakeStockNegative() {
        productos.saveAndFlush(producto("STOCK-1"));
        assertThat(productos.descontarStockAtomicamente("STOCK-1", 2)).isEqualTo(1);
        assertThat(productos.descontarStockAtomicamente("STOCK-1", 2)).isZero();
        entityManager.clear();
        assertThat(productos.findById("STOCK-1").orElseThrow().getStock()).isEqualTo(1);
    }

    @Test
    void reviewTextAndAzureIdentityPersistInNewSchema() {
        Usuario usuario = new Usuario();
        usuario.setNombre("Persona");
        usuario.setApellido("Prueba");
        usuario.setRut("12345678-9");
        usuario.setEmail("schema@example.test");
        usuario.setAzureSubject("tenant:object");
        usuario.setPassword("not-a-login-password");
        usuario.setFechaNacimiento("2000-01-01");
        usuario.setRegion("Metropolitana");
        usuario.setComuna("Santiago");
        usuario.setTelefono("123456789");
        usuario.setRol("USER");
        usuarios.saveAndFlush(usuario);
        Producto producto = productos.saveAndFlush(producto("TEXT-1"));
        Resenia resenia = new Resenia();
        resenia.setProducto(producto);
        resenia.setUsuario(usuario);
        resenia.setTexto("x".repeat(4096));
        resenia.setCalificacion(5);
        Long id = resenias.saveAndFlush(resenia).getId();
        entityManager.clear();

        assertThat(resenias.findById(id).orElseThrow().getTexto()).hasSize(4096);
        assertThat(usuarios.findById(usuario.getUsuarioId()).orElseThrow().getAzureSubject())
                .isEqualTo("tenant:object");
    }

    private Producto producto(String id) {
        Producto producto = new Producto();
        producto.setId(id);
        producto.setNombre("Producto " + id);
        producto.setStock(3);
        producto.setPrecio(1000);
        return producto;
    }
}
