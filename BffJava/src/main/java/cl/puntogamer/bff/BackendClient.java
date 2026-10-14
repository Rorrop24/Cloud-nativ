package cl.puntogamer.bff;

import java.net.URI;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class BackendClient {
    private final RestClient client;
    private RestClient adminClient;
    @org.springframework.beans.factory.annotation.Autowired
    void configureAdmin(RestClient.Builder builder,@Value("${app.rabbit-admin-url:http://localhost:8088}")String url){this.adminClient=builder.baseUrl(url).build();}
    private static final ParameterizedTypeReference<List<Map<String, Object>>> ITEMS = new ParameterizedTypeReference<>() {};

    public BackendClient(RestClient.Builder builder, @Value("${app.backend-url}") String baseUrl) {
        URI uri = URI.create(baseUrl);
        if (uri.getHost() == null || uri.getUserInfo() != null || uri.getQuery() != null || uri.getFragment() != null
                || !List.of("http", "https").contains(uri.getScheme())) {
            throw new IllegalArgumentException("Invalid backend URL");
        }
        this.client = builder.baseUrl(baseUrl).build();
    }

    public Map<String, Object> catalog(String token) {
        List<Map<String, Object>> products = client.get().uri("/v2/productos/todos")
                .headers(h -> h.setBearerAuth(token)).retrieve().body(ITEMS);
        List<Map<String, Object>> categories = client.get().uri("/v2/categorias/todas")
                .headers(h -> h.setBearerAuth(token)).retrieve().body(ITEMS);
        if (products == null || categories == null) throw new IllegalStateException("Empty backend response");
        return Map.of("resumen", Map.of("totalProductos", products.size(), "totalCategorias", categories.size()),
                "catalogo", products, "categoriasDisponibles", categories,
                "productos", products, "categorias", categories);
    }

    public Object queue(String name, String token) {
        return (adminClient==null?client:adminClient).get().uri("/api/rabbitmq/queues/{name}", name)
                .headers(h -> h.setBearerAuth(token)).retrieve().body(Object.class);
    }

    public Object profile(String token) {
        return client.post().uri("/v2/usuarios/sync-azure").contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .headers(h -> h.setBearerAuth(token)).body(Map.of()).retrieve().body(Object.class);
    }
}
