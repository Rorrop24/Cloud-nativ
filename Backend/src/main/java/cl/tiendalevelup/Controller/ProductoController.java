package cl.tiendalevelup.Controller;

import cl.tiendalevelup.Entity.Producto;
import cl.tiendalevelup.Service.ProductoService;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping("/v2/productos")
@Tag(name = "Productos", description = "Operaciones relacionadas con los productos de la tienda")
public class ProductoController {

    @Autowired
    private ProductoService service;

    @GetMapping("/destacados")
    public List<Producto> getDestacados() {
        return service.getProductosDestacados();
    }

    @Operation(
    summary = "Crear un producto",
    description = "Solo admins pueden crear productos",
    security = @SecurityRequirement(name = "basicAuth")
    )
    @PostMapping("/crear")
    public Producto crearProducto(@RequestBody Producto p) {
        return service.guardarProducto(p);
    }

    @Operation(
        summary = "Listar todos los productos",
        description = "Devuelve un listado completo con todos los productos registrados en el sistema.")
    @GetMapping("/todos")
    public List<Producto> obtenerTodos() {
        return service.listarProductos();
    }

    @Operation(
        summary = "Buscar producto por ID",
        description = "Busca un producto específico usando su ID.")
    @GetMapping("/buscar/id/{id}")
    public ResponseEntity<Producto> buscarPorId(@PathVariable String id) {
        return service.obtenerPorId(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @Operation(
        summary = "Buscar producto por nombre",
        description = "Permite obtener un producto a partir de su nombre exacto.")
    @GetMapping("/buscar/nombre/{nombre}")
    public ResponseEntity<Producto> buscarPorNombre(@PathVariable String nombre) {
        return service.buscarPorNombre(nombre)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @Operation(
        summary = "Actualizar un producto",
        description = "Modifica los datos de un producto existente utilizando su ID.")
    @PutMapping("/actualizar/{id}")
    public ResponseEntity<Producto> actualizarProducto(@PathVariable String id, @RequestBody Producto p) {
        Producto actualizada = service.actualizarProducto(id, p);
        if (actualizada != null) {
            return ResponseEntity.ok(actualizada);
        } else {
            return ResponseEntity.notFound().build();
        }
    }

    @Operation(
        summary = "Eliminar un producto",
        description = "Elimina un producto del sistema utilizando su ID.")
    @DeleteMapping("/eliminar/id/{id}")
    public ResponseEntity<String> eliminarProducto(@PathVariable String id) {
        boolean eliminado = service.eliminarProducto(id);
        if (eliminado) {
            return ResponseEntity.ok("Producto eliminado: " + id);
        } else {
            return ResponseEntity.notFound().build();
        }
    }
}
