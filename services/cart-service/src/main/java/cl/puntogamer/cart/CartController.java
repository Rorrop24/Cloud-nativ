package cl.puntogamer.cart;
import cl.puntogamer.messaging.Identity;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/cart")
public class CartController {
    private final CartService service;
    public CartController(CartService service){this.service=service;}
    public record ItemRequest(@NotBlank @Size(max=255) String productId,@Min(1) @Max(100) int quantity){}
    public record QuantityRequest(@Min(1) @Max(100) int quantity){}
    @GetMapping public Map<String,Object> get(@AuthenticationPrincipal Jwt jwt){return service.get(Identity.owner(jwt));}
    @PostMapping("/items") public Map<String,Object> add(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody ItemRequest request){service.add(Identity.owner(jwt),request.productId(),request.quantity());return get(jwt);}
    @PutMapping("/items/{productId}") public Map<String,Object> quantity(@AuthenticationPrincipal Jwt jwt,@PathVariable String productId,@Valid @RequestBody QuantityRequest request){service.quantity(Identity.owner(jwt),productId,request.quantity());return get(jwt);}
    @DeleteMapping("/items/{productId}") public Map<String,Object> remove(@AuthenticationPrincipal Jwt jwt,@PathVariable String productId){service.remove(Identity.owner(jwt),productId);return get(jwt);}
    @DeleteMapping public Map<String,Object> clear(@AuthenticationPrincipal Jwt jwt){service.clear(Identity.owner(jwt));return get(jwt);}
    @PostMapping("/checkout") public Object checkout(@AuthenticationPrincipal Jwt jwt){return service.checkout(Identity.owner(jwt),jwt.getTokenValue());}
}
