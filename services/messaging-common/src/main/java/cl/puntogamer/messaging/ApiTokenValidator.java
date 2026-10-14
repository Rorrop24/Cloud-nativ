package cl.puntogamer.messaging;

import java.time.Duration;
import org.springframework.security.oauth2.core.*;
import org.springframework.security.oauth2.jwt.*;

public final class ApiTokenValidator {
    private ApiTokenValidator() {}

    public static OAuth2TokenValidator<Jwt> create(String issuer, String audience) {
        if (issuer == null || issuer.isBlank() || audience == null || audience.isBlank()) {
            throw new IllegalArgumentException("Issuer and audience must be configured");
        }
        OAuth2TokenValidator<Jwt> required = jwt -> {
            if (jwt.getExpiresAt() == null || jwt.getSubject() == null || jwt.getSubject().isBlank()
                    || jwt.getAudience() == null || !jwt.getAudience().contains(audience)) {
                return OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token",
                        "Missing required claims or invalid audience", null));
            }
            return OAuth2TokenValidatorResult.success();
        };
        return new DelegatingOAuth2TokenValidator<>(
                new JwtTimestampValidator(Duration.ZERO), new JwtIssuerValidator(issuer), required);
    }
}
