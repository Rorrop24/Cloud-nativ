package cl.tiendalevelup.Service;
import cl.tiendalevelup.Entity.*;
import cl.tiendalevelup.Repository.*;
import java.math.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
@Service
public class BoletaService {
    private final BoletaRepository boletas;private final UsuarioRepository usuarios;private final ProductoRepository productos;private final PedidoProducerService producer;
    public BoletaService(BoletaRepository boletas,UsuarioRepository usuarios,ProductoRepository productos,PedidoProducerService producer){this.boletas=boletas;this.usuarios=usuarios;this.productos=productos;this.producer=producer;}
    @Transactional public Boleta generarBoleta(int usuarioId,List<Map<String,Object>> items){return generarBoleta(usuarioId,items,null);}
    @Transactional public Boleta generarBoleta(int usuarioId,List<Map<String,Object>> items,String requestId){
        if(requestId!=null){
            if(requestId.isBlank()||requestId.length()>100)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Clave de compra invalida");
            var existing=boletas.findByRequestId(requestId);
            if(existing.isPresent()){if(existing.get().getUsuario().getUsuarioId()!=usuarioId)throw new ResponseStatusException(HttpStatus.FORBIDDEN);return existing.get();}
        }
        var user=usuarios.findById(usuarioId).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Usuario no encontrado"));
        if(items==null||items.isEmpty()||items.size()>100)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Carrito vacio o demasiado grande");
        var quantities=new TreeMap<String,Integer>();
        for(var item:items){
            Object value=item.get("cantidad");String id=Objects.toString(item.get("productoId"),"");
            if(id.isBlank()||!(value instanceof Number number)||number.doubleValue()!=number.intValue()||number.intValue()<1||number.intValue()>100)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Producto o cantidad invalidos");
            quantities.merge(id,((Number)value).intValue(),Integer::sum);
        }
        var receipt=new Boleta();receipt.setUsuario(user);receipt.setRequestId(requestId);receipt.setFechaEmision(new Date());BigDecimal total=BigDecimal.ZERO;
        var events=new ArrayList<Map<String,Object>>();
        for(var entry:quantities.entrySet()){
            int quantity=entry.getValue();if(quantity>100)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Cantidad excedida");
            var product=productos.findById(entry.getKey()).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Producto no encontrado"));
            if(!Double.isFinite(product.getPrecio())||product.getPrecio()<0)throw new ResponseStatusException(HttpStatus.CONFLICT,"Precio de catalogo invalido");
            double discount=product.getDescuento();
            if(discount<0||discount>100)throw new ResponseStatusException(HttpStatus.CONFLICT,"Descuento de catalogo invalido");
            BigDecimal price=BigDecimal.valueOf(product.getPrecio()).multiply(BigDecimal.valueOf(1-discount/100)).setScale(2,RoundingMode.HALF_UP);
            if(productos.descontarStockAtomicamente(product.getId(),quantity)!=1)throw new ResponseStatusException(HttpStatus.CONFLICT,"Stock insuficiente para "+product.getNombre());
            var detail=new DetalleBoleta();detail.setBoleta(receipt);detail.setProducto(product);detail.setCantidad(quantity);detail.setPrecioUnitario(price.doubleValue());detail.setSubtotal(price.multiply(BigDecimal.valueOf(quantity)).doubleValue());receipt.getDetalles().add(detail);
            total=total.add(BigDecimal.valueOf(detail.getSubtotal()));events.add(Map.of("productoId",product.getId(),"cantidad",quantity,"stockAfter",productos.stockActual(product.getId())));
        }
        receipt.setTotal(total.doubleValue());var saved=boletas.saveAndFlush(receipt);
        producer.publicarEventosDeCompra(saved.getId(),events,saved.getTotal(),user.getEmail(),user.getAzureSubject());
        return saved;
    }
    public Boleta getBoletaById(Long id){return boletas.findById(id).orElse(null);}
    public List<Boleta> getBoletasByUsuario(int usuarioId){return boletas.findByUsuario_UsuarioId(usuarioId);}
}
