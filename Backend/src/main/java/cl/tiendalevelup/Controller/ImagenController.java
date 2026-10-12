package cl.tiendalevelup.Controller;

import cl.tiendalevelup.Entity.Imagen;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.TypedQuery;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/v2/imagenes")
public class ImagenController {

    @PersistenceContext
    private EntityManager entityManager;

    @GetMapping("/tipo/{tipo}")
    public List<Imagen> obtenerPorTipo(@PathVariable String tipo) {
        TypedQuery<Imagen> query = entityManager.createQuery(
            "SELECT i FROM Imagen i WHERE i.tipo = :tipo", Imagen.class);
        query.setParameter("tipo", tipo);
        return query.getResultList();
    }
}
