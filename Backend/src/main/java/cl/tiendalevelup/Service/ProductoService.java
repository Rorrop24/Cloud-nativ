package cl.tiendalevelup.Service;

import cl.tiendalevelup.Entity.Producto;
import cl.tiendalevelup.Repository.ProductoRepository;
import java.util.List;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProductoService {

    @Autowired
    private ProductoRepository repository;
    
    public List<Producto> getProductosDestacados() {
        return repository.findTop3Destacados();
    }

    public Producto guardarProducto(Producto p) {
        return repository.save(p);
    }

    public List<Producto> listarProductos() {
        return repository.findAll();
    }

    public Optional<Producto> obtenerPorId(String id) {
        return repository.findById(id);
    }

    public Optional<Producto> buscarPorNombre(String nombre) {
        return repository.findByNombre(nombre);
    }

    public Producto actualizarProducto(String id, Producto p) {
        return repository.findById(id).map(prod -> {
            prod.setNombre(p.getNombre());
            prod.setPrecio(p.getPrecio());
            prod.setDescuento(p.getDescuento());
            prod.setOferta(p.isOferta());
            prod.setRating(p.getRating());
            prod.setDescripcion(p.getDescripcion());
            prod.setImagen(p.getImagen());
            prod.setStock(p.getStock());
            prod.setStockCritico(p.getStockCritico());
            prod.setDetalles(p.getDetalles());
            prod.setCategoria(p.getCategoria());
            return repository.save(prod);
        }).orElse(null);
    }

    public boolean eliminarProducto(String id) {
        if (repository.existsById(id)) {
            repository.deleteById(id);
            return true;
        }
        return false;
    }

    // =========================================================================
    // LÓGICA DE NEGOCIO PARA INVENTARIO Y STOCK
    // =========================================================================
    @Transactional
    public boolean descontarStock(String id, int cantidad) {
        Optional<Producto> opt = repository.findById(id);
        if (opt.isEmpty()) {
            System.err.println("[INVENTARIO ERROR] Producto inexistente: " + id);
            return false;
        }

        Producto producto = opt.get();
        if (producto.getStock() < cantidad) {
            System.err.println("[INVENTARIO STOCK INSUFICIENTE] Producto: " + producto.getNombre() + 
                               " | Stock actual: " + producto.getStock() + " | Requerido: " + cantidad);
            return false;
        }

        int filas = repository.descontarStockAtomicamente(id, cantidad);
        if (filas > 0) {
            int nuevoStock = producto.getStock() - cantidad;
            System.out.println("[INVENTARIO ACTUALIZADO] Producto: " + producto.getNombre() + 
                               " | Nuevo stock: " + nuevoStock);

            if (nuevoStock <= producto.getStockCritico()) {
                System.out.println("⚠️ [ALERTA STOCK CRÍTICO] " + producto.getNombre() + 
                                   " quedó con " + nuevoStock + " unidades (Umbral: " + producto.getStockCritico() + ")");
            }
            return true;
        }

        return false;
    }
}