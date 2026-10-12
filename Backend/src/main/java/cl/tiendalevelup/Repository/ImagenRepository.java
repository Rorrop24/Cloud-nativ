package cl.tiendalevelup.Repository;

import cl.tiendalevelup.Entity.Imagen;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ImagenRepository extends JpaRepository<Imagen, Long> {
    List<Imagen> findByTipo(String tipo);
}
