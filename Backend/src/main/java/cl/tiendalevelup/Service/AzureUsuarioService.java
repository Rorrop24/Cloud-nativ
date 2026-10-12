package cl.tiendalevelup.Service;

import cl.tiendalevelup.Entity.Usuario;
import cl.tiendalevelup.Repository.UsuarioRepository;
import cl.tiendalevelup.security.UsuarioAccess;
import java.util.Locale;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AzureUsuarioService {
    private final UsuarioRepository repository;
    private final PasswordEncoder encoder;

    public AzureUsuarioService(UsuarioRepository repository, PasswordEncoder encoder) {
        this.repository = repository;
        this.encoder = encoder;
    }

    @Transactional
    public Usuario sync(JwtAuthenticationToken authentication) {
        String identity = UsuarioAccess.identity(authentication);
        if (identity == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Faltan tid/oid de Azure");
        var existing = repository.findByAzureSubject(identity);
        if (existing.isPresent()) return existing.get();
        String email = authentication.getToken().getClaimAsString("preferred_username");
        if (email == null) email = authentication.getToken().getClaimAsString("email");
        if (email == null || !email.contains("@") || email.length() > 200) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Configura el claim email en el access token");
        }
        email = email.trim().toLowerCase(Locale.ROOT);
        // Never link legacy accounts by an editable email claim. Linking requires an administrator.
        if (repository.existsByEmail(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La cuenta existente requiere vinculacion administrativa");
        }
        String name = authentication.getToken().getClaimAsString("name");
        String[] parts = (name == null || name.isBlank() ? "Usuario Azure" : name.trim()).split(" ", 2);
        Usuario user = new Usuario();
        user.setAzureSubject(identity);
        user.setEmail(email);
        user.setNombre(parts[0].substring(0, Math.min(100, parts[0].length())));
        String surname = parts.length > 1 ? parts[1] : "Azure";
        user.setApellido(surname.substring(0, Math.min(100, surname.length())));
        user.setRut("AZ" + UUID.randomUUID().toString().replace("-", "").substring(0, 8));
        user.setPassword(encoder.encode(UUID.randomUUID().toString()));
        user.setFechaNacimiento("2000-01-01");
        user.setRegion("Sin definir");
        user.setComuna("Sin definir");
        user.setTelefono("Sin definir");
        user.setEsDuoc(email.endsWith("@duoc.cl") || email.endsWith("@duocuc.cl"));
        user.setRol("USER");
        return repository.save(user);
    }
}
