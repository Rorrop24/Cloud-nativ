package cl.tiendalevelup.Repository;

import cl.tiendalevelup.Entity.Resenia;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ReseniaRepository extends JpaRepository<Resenia, Long> {

    // Buscar reseñas por ID del producto (Producto.id es String)
    List<Resenia> findByProducto_Id(String productoId);

    // Opcional: buscar por usuario
    List<Resenia> findByUsuario_UsuarioId(int usuarioId);
}
