package cl.tiendalevelup.Controller;

import cl.tiendalevelup.Entity.Categoria;
import cl.tiendalevelup.Service.CategoriaService;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

//Importar las librerias de Swagger para la comuentacion de las APIs
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping("/v2/categorias")
@Tag(name = "Categoria", description = "Operaciones relacionadas sobre las categorias de la tienda")
public class CategoriaController {

    @Autowired
    private CategoriaService service;

    @Operation(
    summary = "Crear una nueva categoría",
    description = "Permite registrar una nueva categoría en el sistema con sus datos.")
    @PostMapping("/crear")
    public Categoria crearCategoria(@RequestBody Categoria c) {
        return service.guardarCategoria(c);
    }

    @Operation(
    summary = "Listar todas las categorías",
    description = "Devuelve un listado completo de todas las categorías registradas en el sistema.")
    @GetMapping("/todas")
    public List<Categoria> obtenerTodos() {
        return service.listarCategorias();
    }

    @Operation(
    summary = "Buscar categoría por ID",
    description = "Busca una categoría específica utilizando su ID.")
    @GetMapping("/buscar/id/{id}")
    public ResponseEntity<Categoria> buscarPorId(@PathVariable Long id) {
        return service.obtenerPorId(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @Operation(
    summary = "Buscar categoría por nombre",
    description = "Permite buscar una categoría utilizando su nombre.")
    @GetMapping("/buscar/nombre/{nombre}")
    public ResponseEntity<Categoria> buscarPorNombre(@PathVariable String nombre) {
        return service.buscarPorNombre(nombre)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @Operation(
    summary = "Actualizar una categoría",
    description = "Actualiza los datos de una categoría existente según su ID.")
    @PutMapping("/actualizar/{id}")
    public ResponseEntity<Categoria> actualizarCategoria(@PathVariable Long id, @RequestBody Categoria c) {
        Categoria actualizada = service.actualizarCategoria(id, c);
        if (actualizada != null) {
            return ResponseEntity.ok(actualizada);
        } else {
            return ResponseEntity.notFound().build();
        }
    }

    @Operation(
    summary = "Eliminar una categoría",
    description = "Elimina una categoría del sistema utilizando su ID. Retorna un mensaje en caso de que sea exitoso.")
    @DeleteMapping("/eliminar/id/{id}")
    public ResponseEntity<String> eliminarCategoria(@PathVariable Long id) {
        boolean eliminado = service.eliminarCategoria(id);
        if (eliminado) {
            return ResponseEntity.ok("Categoría eliminada: " + id);
        } else {
            return ResponseEntity.notFound().build();
        }
    }
}
