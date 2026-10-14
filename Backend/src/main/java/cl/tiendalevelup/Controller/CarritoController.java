package cl.tiendalevelup.Controller;

import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;

/** Compatibility routes; the cart service owns persistence and JWT identity. */
@RestController
@RequestMapping("/v2/carrito")
@PreAuthorize("@usuarioAccess.owns(authentication, #usuarioId)")
public class CarritoController {
    private final RestClient cart;

    public CarritoController(RestClient.Builder builder, @Value("${app.cart-url}") String url) {
        cart = builder.baseUrl(url).build();
    }

    @GetMapping("/{usuarioId}")
    public Object get(@PathVariable Long usuarioId, JwtAuthenticationToken auth) {
        return cart.get().uri("/api/cart").header(HttpHeaders.AUTHORIZATION, bearer(auth)).retrieve().body(Map.class);
    }

    @PostMapping("/{usuarioId}/agregar/{productoId}")
    public Object add(@PathVariable Long usuarioId, @PathVariable String productoId,
                      @RequestParam(defaultValue="1") int cantidad, JwtAuthenticationToken auth) {
        return cart.post().uri("/api/cart/items").header(HttpHeaders.AUTHORIZATION, bearer(auth))
            .body(Map.of("productId", productoId, "quantity", cantidad)).retrieve().body(Map.class);
    }

    @PutMapping("/{usuarioId}/item/{productoId}")
    public Object quantity(@PathVariable Long usuarioId, @PathVariable String productoId,
                           @RequestParam int cantidad, JwtAuthenticationToken auth) {
        if (cantidad <= 0) return remove(usuarioId, productoId, auth);
        return cart.put().uri("/api/cart/items/{id}", productoId).header(HttpHeaders.AUTHORIZATION, bearer(auth))
            .body(Map.of("quantity", cantidad)).retrieve().body(Map.class);
    }

    @DeleteMapping("/{usuarioId}/item/{productoId}")
    public Object remove(@PathVariable Long usuarioId, @PathVariable String productoId, JwtAuthenticationToken auth) {
        return cart.delete().uri("/api/cart/items/{id}", productoId).header(HttpHeaders.AUTHORIZATION, bearer(auth)).retrieve().body(Map.class);
    }

    @DeleteMapping("/{usuarioId}/vaciar")
    public Object clear(@PathVariable Long usuarioId, JwtAuthenticationToken auth) {
        return cart.delete().uri("/api/cart").header(HttpHeaders.AUTHORIZATION, bearer(auth)).retrieve().body(Map.class);
    }

    private String bearer(JwtAuthenticationToken auth) { return "Bearer " + auth.getToken().getTokenValue(); }
}
