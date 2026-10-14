package cl.puntogamer.cart;
import cl.puntogamer.messaging.*;
import java.util.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;
@Service
public class CartService {
    private final JdbcTemplate jdbc;private final RestClient backend;private final Outbox outbox;private final MessagingProperties properties;
    public CartService(JdbcTemplate jdbc,RestClient.Builder builder,@Value("${app.backend-url}")String backendUrl,Outbox outbox,MessagingProperties properties){this.jdbc=jdbc;this.backend=builder.baseUrl(backendUrl).build();this.outbox=outbox;this.properties=properties;}
    @SuppressWarnings("unchecked") private Map<String,Object> product(String id){
        try{return backend.get().uri("/v2/productos/buscar/id/{id}",id).retrieve().body(Map.class);}
        catch(org.springframework.web.client.HttpClientErrorException.NotFound e){throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Producto no encontrado");}
    }
    public Map<String,Object> get(String owner){
        var items=new ArrayList<Map<String,Object>>();double total=0;
        for(var row:lines(owner)){
            var p=product((String)row.get("product_id"));int quantity=((Number)row.get("quantity")).intValue();
            double price=((Number)p.get("precio")).doubleValue();double discount=p.get("descuento") instanceof Number n?n.doubleValue():0;
            double unit=price*(1-discount/100);var item=new LinkedHashMap<String,Object>(p);item.put("quantity",quantity);item.put("unitPrice",unit);items.add(item);total+=unit*quantity;
        }
        return Map.of("items",items,"total",Math.round(total*100.0)/100.0);
    }
    private List<Map<String,Object>> lines(String owner){return jdbc.queryForList("SELECT product_id,quantity FROM cart_lines WHERE owner=? ORDER BY product_id",owner);}
    @Transactional public void add(String owner,String id,int quantity){
        validate(id,quantity);var p=product(id);int stock=((Number)p.get("stock")).intValue();
        // Ensure an existing row is locked before accumulating quantity. A duplicate first insert rolls back safely.
        var current=jdbc.queryForList("SELECT quantity FROM cart_lines WHERE owner=? AND product_id=? FOR UPDATE",owner,id);
        int next=quantity+(current.isEmpty()?0:((Number)current.get(0).get("quantity")).intValue());
        if(next>100||next>stock)throw new ResponseStatusException(HttpStatus.CONFLICT,"Cantidad supera el stock disponible");
        if(current.isEmpty())jdbc.update("INSERT INTO cart_lines(owner,product_id,quantity) VALUES (?,?,?)",owner,id,next);
        else jdbc.update("UPDATE cart_lines SET quantity=?,updated_at=CURRENT_TIMESTAMP WHERE owner=? AND product_id=?",next,owner,id);
        event("CART-ADD",id);
    }
    @Transactional public void quantity(String owner,String id,int quantity){
        validate(id,quantity);if(quantity>((Number)product(id).get("stock")).intValue())throw new ResponseStatusException(HttpStatus.CONFLICT,"Stock insuficiente");
        if(jdbc.update("UPDATE cart_lines SET quantity=?,updated_at=CURRENT_TIMESTAMP WHERE owner=? AND product_id=?",quantity,owner,id)==0)throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Producto no esta en el carrito");
        event("CART-UPDATE",id);
    }
    @Transactional public void remove(String owner,String id){jdbc.update("DELETE FROM cart_lines WHERE owner=? AND product_id=?",owner,id);event("CART-REMOVE",id);}
    @Transactional public void clear(String owner){jdbc.update("DELETE FROM cart_lines WHERE owner=?",owner);}
    private void validate(String id,int quantity){if(id==null||id.isBlank()||quantity<1||quantity>100)throw new IllegalArgumentException("Producto y cantidad invalidos");}
    private void event(String action,String id){outbox.enqueue(properties.exchange(),properties.pedidos().routingKey(),Map.of("idPedido",action+"-"+UUID.randomUUID(),"mensaje",action,"productoId",id));}
    @Transactional @SuppressWarnings("unchecked") public Object checkout(String owner,String token){
        // Lock the cart across concurrent checkout requests; a second request observes the cleared cart.
        var cart=jdbc.queryForList("SELECT product_id,quantity FROM cart_lines WHERE owner=? ORDER BY product_id FOR UPDATE",owner);
        if(cart.isEmpty())throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"El carrito esta vacio");
        Map<String,Object> user=backend.post().uri("/v2/usuarios/sync-azure").header(HttpHeaders.AUTHORIZATION,"Bearer "+token).retrieve().body(Map.class);
        var items=cart.stream().map(line->Map.of("productoId",line.get("product_id"),"cantidad",line.get("quantity"))).toList();
        Map<?,?> receipt=backend.post().uri("/v2/boletas/generar").header(HttpHeaders.AUTHORIZATION,"Bearer "+token).body(Map.of("usuarioId",user.get("usuarioId"),"items",items,"requestId",checkoutKey(owner,cart))).retrieve().body(Map.class);
        jdbc.update("DELETE FROM cart_lines WHERE owner=?",owner);jdbc.update("DELETE FROM cart_checkout_attempt WHERE owner=?",owner);return Map.of("id",receipt.get("id"),"total",receipt.get("total"));
    }

    private String checkoutKey(String owner,List<Map<String,Object>> lines){
        try {
            String fingerprint=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(lines.toString().getBytes(StandardCharsets.UTF_8)));
            var transaction=new TransactionTemplate(new DataSourceTransactionManager(jdbc.getDataSource()));transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
            return transaction.execute(status->{
                var existing=jdbc.queryForList("SELECT request_id,fingerprint FROM cart_checkout_attempt WHERE owner=? FOR UPDATE",owner);
                if(!existing.isEmpty()&&fingerprint.equals(existing.get(0).get("fingerprint")))return (String)existing.get(0).get("request_id");
                String key="CART-"+UUID.randomUUID();
                if(existing.isEmpty())jdbc.update("INSERT INTO cart_checkout_attempt(owner,request_id,fingerprint) VALUES(?,?,?)",owner,key,fingerprint);
                else jdbc.update("UPDATE cart_checkout_attempt SET request_id=?,fingerprint=? WHERE owner=?",key,fingerprint,owner);
                return key;
            });
        }catch(java.security.NoSuchAlgorithmException e){throw new IllegalStateException(e);}
    }
}
