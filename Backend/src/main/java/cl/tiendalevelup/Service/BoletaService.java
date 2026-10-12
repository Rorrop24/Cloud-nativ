package cl.tiendalevelup.Service;

import cl.tiendalevelup.Entity.*;
import cl.tiendalevelup.Repository.*;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;

@Service
public class BoletaService {

    @Autowired
    private BoletaRepository boletaRepository;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private ProductoRepository productoRepository;

    @Autowired(required = false)
    private PedidoProducerService pedidoProducerService;

    @Transactional
    public Boleta generarBoleta(int usuarioId, List<Map<String, Object>> items) {

        // 1. Validar usuario en Oracle Autonomous Database
        Usuario usuario = usuarioRepository.findById(usuarioId)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado en base de datos con ID: " + usuarioId));

        if (items == null || items.isEmpty()) {
            throw new RuntimeException("El carrito recibido está vacío");
        }

        // 2. Crear boleta
        Boleta boleta = new Boleta();
        boleta.setUsuario(usuario);
        boleta.setFechaEmision(new Date());

        // Asegurar que la lista de detalles no sea nula
        if (boleta.getDetalles() == null) {
            boleta.setDetalles(new ArrayList<>());
        }

        double total = 0;

        for (Map<String, Object> item : items) {
            String productoId = String.valueOf(item.get("productoId"));
            
            // Conversión segura de tipos numéricos evitando ClassCastException
            int cantidad = item.get("cantidad") instanceof Number 
                    ? ((Number) item.get("cantidad")).intValue() 
                    : Integer.parseInt(String.valueOf(item.get("cantidad")));

            double precioUnitario = item.get("precioUnitario") instanceof Number
                    ? ((Number) item.get("precioUnitario")).doubleValue()
                    : Double.parseDouble(String.valueOf(item.get("precioUnitario")));

            Producto producto = productoRepository.findById(productoId)
                    .orElseThrow(() -> new RuntimeException("Producto no encontrado en catálogo con ID: " + productoId));

            if (producto.getStock() < cantidad) {
                throw new RuntimeException("Stock insuficiente para: " + producto.getNombre());
            }

            // Descontar inventario
            producto.setStock(producto.getStock() - cantidad);
            productoRepository.save(producto);

            DetalleBoleta detalle = new DetalleBoleta();
            detalle.setBoleta(boleta);
            detalle.setProducto(producto);
            detalle.setCantidad(cantidad);
            detalle.setPrecioUnitario(precioUnitario);
            detalle.setSubtotal(cantidad * precioUnitario);

            boleta.getDetalles().add(detalle);
            total += detalle.getSubtotal();
        }

        boleta.setTotal(total);

        // 3. Guardar boleta y sus detalles en Oracle Autonomous Database
        Boleta boletaGuardada = boletaRepository.save(boleta);

        // 4. Disparar evento hacia RabbitMQ (pedidos.queue)
        if (pedidoProducerService != null) {
            String descripcion = String.format("Boleta N° %d generada para %s %s por un total de $%.2f (%d items)",
                    boletaGuardada.getId(),
                    usuario.getNombre() != null ? usuario.getNombre() : "Cliente",
                    usuario.getApellido() != null ? usuario.getApellido() : "",
                    boletaGuardada.getTotal(),
                    boletaGuardada.getDetalles().size());

            pedidoProducerService.enviarPedido("BOL-" + boletaGuardada.getId(), descripcion);
        }

        return boletaGuardada;
    }

    public Boleta getBoletaById(Long id) {
        return boletaRepository.findById(id).orElse(null);
    }

    public List<Boleta> getBoletasByUsuario(int usuarioId) {
        return boletaRepository.findByUsuario_UsuarioId(usuarioId);
    }
}