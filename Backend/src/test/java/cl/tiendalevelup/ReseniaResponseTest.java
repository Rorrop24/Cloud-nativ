package cl.tiendalevelup;

import cl.tiendalevelup.Entity.*;
import cl.tiendalevelup.dto.ReseniaResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class ReseniaResponseTest {
    @Test void publicReviewsNeverIncludePrivateUserFields() throws Exception {
        Usuario user = new Usuario();
        user.setNombre("Cliente");
        user.setEmail("private@example.test");
        user.setPassword("private-hash");
        user.setAzureSubject("private-azure-identity");
        user.setRut("12345678-9");
        Resenia review = new Resenia();
        review.setUsuario(user); review.setCalificacion(5); review.setTexto("Muy bueno"); review.setFecha(null);
        String json = new ObjectMapper().writeValueAsString(ReseniaResponse.from(review));
        assertTrue(json.contains("\"nombre\":\"Cliente\""));
        for (String field : new String[]{"email", "password", "azureSubject", "rut"}) assertFalse(json.contains(field));
    }
}
