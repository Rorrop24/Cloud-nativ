package cl.tiendalevelup.Controller;

import cl.tiendalevelup.Entity.Usuario;
import cl.tiendalevelup.Service.AzureUsuarioService;
import cl.tiendalevelup.Service.UsuarioService;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/v2/usuarios")
public class UsuarioController {
    private final UsuarioService service;
    private final AzureUsuarioService azure;

    public UsuarioController(UsuarioService service, AzureUsuarioService azure) {
        this.service = service;
        this.azure = azure;
    }

    @PostMapping("/sync-azure")
    public Usuario syncAzure(JwtAuthenticationToken authentication) {
        return azure.sync(authentication);
    }

    @GetMapping("/todos")
    public List<Usuario> obtenerTodos() { return service.getUsuarios(); }

    @GetMapping("/buscar/id/{usuarioId}")
    @PreAuthorize("@usuarioAccess.owns(authentication, #usuarioId)")
    public Usuario buscarPorId(@PathVariable int usuarioId) {
        return service.getUsuarioById(usuarioId);
    }

    @GetMapping("/buscar/email/{email}")
    public ResponseEntity<Usuario> buscarPorEmail(@PathVariable String email) {
        Usuario user = service.getUsuarioByEmail(email);
        return user == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(user);
    }

    @GetMapping("/buscar/rut/{rut}")
    public Usuario buscarPorRut(@PathVariable String rut) { return service.getUsuarioByRut(rut); }

    @GetMapping("/buscar/nombre/{nombre}")
    public Usuario buscarPorNombre(@PathVariable String nombre) { return service.getUsuarioByNombre(nombre); }

    @PostMapping("/crear")
    public Usuario crearUsuario(@RequestBody Usuario user) {
        user.setRol("USER");
        user.setAzureSubject(null);
        return service.saveUsuario(user);
    }

    @PutMapping("/actualizar")
    @PreAuthorize("@usuarioAccess.owns(authentication, #user.usuarioId)")
    public Usuario actualizarUsuario(@RequestBody Usuario user) { return service.updateUsuario(user); }

    @DeleteMapping("/eliminar/id/{usuarioId}")
    public String eliminarUsuario(@PathVariable int usuarioId) { return service.deleteUsuario(usuarioId); }

    @DeleteMapping("/eliminar/rut/{rut}")
    public String eliminarPorRut(@PathVariable String rut) { return service.deleteUsuarioByRut(rut); }
}
