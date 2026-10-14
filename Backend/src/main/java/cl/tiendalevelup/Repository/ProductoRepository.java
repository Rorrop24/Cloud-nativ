package cl.tiendalevelup.Repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import cl.tiendalevelup.Entity.Producto;

public interface ProductoRepository extends JpaRepository<Producto, String> {
    @Query("SELECT p.stock FROM Producto p WHERE p.id = :id")
    Integer stockActual(@Param("id") String id);


    Optional<Producto> findByNombre(String nombre);

    List<Producto> findTop3ByDestacadoTrueOrderByIdAsc();

    // Descuenta stock atomicamente evitando valores negativos.
    @Modifying
    @Transactional
    @Query("UPDATE Producto p SET p.stock = p.stock - :cantidad WHERE p.id = :id AND p.stock >= :cantidad")
    int descontarStockAtomicamente(@Param("id") String id, @Param("cantidad") int cantidad);
}
