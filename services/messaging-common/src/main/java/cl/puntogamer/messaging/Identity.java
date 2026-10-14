package cl.puntogamer.messaging;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.server.ResponseStatusException;
public final class Identity {
    private Identity() {}
    public static String owner(Jwt jwt) {
        String tenant=jwt.getClaimAsString("tid"),object=jwt.getClaimAsString("oid");
        if(tenant==null||object==null||tenant.length()>40||object.length()>40) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Faltan tid/oid de Azure");
        return tenant+":"+object;
    }
}
