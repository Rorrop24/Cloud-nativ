package cl.tiendalevelup.Repository;

import org.springframework.data.jpa.repository.JpaRepository;
import cl.tiendalevelup.Entity.DetalleBoleta;
import java.util.List;

public interface DetalleBoletaRepository extends JpaRepository<DetalleBoleta, Long> {

    List<DetalleBoleta> findByBoletaId(Long boletaId);

}
