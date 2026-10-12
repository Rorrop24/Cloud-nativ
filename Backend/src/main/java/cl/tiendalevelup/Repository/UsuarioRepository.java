package cl.tiendalevelup.Repository;

import cl.tiendalevelup.Entity.Usuario;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface UsuarioRepository extends JpaRepository<Usuario, Integer> {
    Optional<Usuario> findByAzureSubject(String azureSubject);
    
    Usuario findByNombre(String nombre);

    Usuario findByRut(String rut);

    boolean existsByEmail(String email);

    boolean existsByRut(String rut);

    void deleteByRut(String rut);
    
    Optional<Usuario> findByEmail(String email);
}




