package cl.tiendalevelup.Service;

import cl.tiendalevelup.Entity.Categoria;
import cl.tiendalevelup.Repository.CategoriaRepository;
import java.util.List;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class CategoriaService {

    @Autowired
    private CategoriaRepository repository;

    // Guardar categoría
    public Categoria guardarCategoria(Categoria c) {
        return repository.save(c);
    }

    // Listar todas las categorías
    public List<Categoria> listarCategorias() {
        return repository.findAll();
    }

    // Obtener por ID
    public Optional<Categoria> obtenerPorId(Long id) {
        return repository.findById(id);
    }

    // Buscar por nombre
    public Optional<Categoria> buscarPorNombre(String nombre) {
        return repository.findByNombre(nombre);
    }

    // Actualizar categoría
    public Categoria actualizarCategoria(Long id, Categoria c) {
        return repository.findById(id).map(cat -> {
            cat.setNombre(c.getNombre());
            return repository.save(cat);
        }).orElse(null);
    }

    // Eliminar categoría
    public boolean eliminarCategoria(Long id) {
        if (repository.existsById(id)) {
            repository.deleteById(id);
            return true;
        }
        return false;
    }
}
