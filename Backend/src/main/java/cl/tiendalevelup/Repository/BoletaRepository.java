package cl.tiendalevelup.Repository;

import org.springframework.data.jpa.repository.JpaRepository;
import cl.tiendalevelup.Entity.Boleta;
import java.util.List;


public interface BoletaRepository extends JpaRepository<Boleta, Long> {

    List<Boleta> findByUsuario_UsuarioId(int usuarioId);

}
