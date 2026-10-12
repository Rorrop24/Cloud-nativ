package cl.tiendalevelup.security;

import cl.tiendalevelup.Repository.UsuarioRepository;
import cl.tiendalevelup.Repository.BoletaRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

@Component("usuarioAccess")
public class UsuarioAccess {
    private final UsuarioRepository usuarios;
    private final BoletaRepository boletas;

    public UsuarioAccess(UsuarioRepository usuarios, BoletaRepository boletas) {
        this.usuarios = usuarios;
        this.boletas = boletas;
    }

    public boolean owns(Authentication auth, Object usuarioId) {
        if (admin(auth)) return true;
        if (!(auth instanceof JwtAuthenticationToken token) || !(usuarioId instanceof Number id)) return false;
        String identity = identity(token);
        return identity != null && usuarios.findByAzureSubject(identity)
                .map(u -> u.getUsuarioId() == id.longValue()).orElse(false);
    }

    public boolean ownsBoleta(Authentication auth, Long id) {
        if (admin(auth)) return true;
        return boletas.findById(id).filter(b -> b.getUsuario() != null)
                .map(b -> owns(auth, b.getUsuario().getUsuarioId())).orElse(false);
    }

    public static String identity(JwtAuthenticationToken auth) {
        String tenant = auth.getToken().getClaimAsString("tid");
        String object = auth.getToken().getClaimAsString("oid");
        String uuid = "[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}";
        return tenant != null && object != null && tenant.matches(uuid) && object.matches(uuid)
                ? tenant + ":" + object : null;
    }

    private boolean admin(Authentication auth) {
        return auth != null && auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_Rabbit.Admin"));
    }
}
