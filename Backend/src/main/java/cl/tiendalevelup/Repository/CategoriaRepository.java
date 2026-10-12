package cl.tiendalevelup.Repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import cl.tiendalevelup.Entity.Categoria;

public interface CategoriaRepository extends JpaRepository<Categoria, Long> {
    
    Optional<Categoria> findByNombre(String nombre);
}
