package cl.tiendalevelup.Service;

import cl.tiendalevelup.Entity.Producto;
import cl.tiendalevelup.Entity.Resenia;
import cl.tiendalevelup.Entity.Usuario;
import cl.tiendalevelup.dto.ReseniaResponse;
import cl.tiendalevelup.Repository.ProductoRepository;
import cl.tiendalevelup.Repository.ReseniaRepository;
import cl.tiendalevelup.Repository.UsuarioRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class ReseniaService {

    private final ReseniaRepository reseniaRepository;
    private final ProductoRepository productoRepository;
    private final UsuarioRepository usuarioRepository;

    public ReseniaService(ReseniaRepository reseniaRepository,
                          ProductoRepository productoRepository,
                          UsuarioRepository usuarioRepository) {
        this.reseniaRepository = reseniaRepository;
        this.productoRepository = productoRepository;
        this.usuarioRepository = usuarioRepository;
    }

    // Obtener reseñas por producto
    @Transactional(readOnly = true)
    public List<ReseniaResponse> obtenerReseniasPorProducto(String productoId) {
        return reseniaRepository.findByProducto_Id(productoId).stream().map(ReseniaResponse::from).toList();
    }

    // Guardar reseña
    public Resenia guardarResenia(String productoId, int usuarioId, Resenia resenia) {
        resenia.setId(null);
        
        // Validar producto
        Optional<Producto> productoOpt = productoRepository.findById(productoId);
        if (productoOpt.isEmpty()) {
            throw new RuntimeException("Producto no encontrado: " + productoId);
        }

        // Validar usuario
        Optional<Usuario> usuarioOpt = usuarioRepository.findById(usuarioId);
        if (usuarioOpt.isEmpty()) {
            throw new RuntimeException("Usuario no encontrado: " + usuarioId);
        }

        resenia.setProducto(productoOpt.get());
        resenia.setUsuario(usuarioOpt.get());

        return reseniaRepository.save(resenia);
    }
}
