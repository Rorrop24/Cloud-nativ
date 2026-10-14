FROM eclipse-temurin:21-jre-jammy

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Certificados publicos del servidor RDS, no un wallet ni credenciales de cliente.
RUN curl --fail --location --retry 5 --proto '=https' --proto-redir '=https' \
        https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem -o /tmp/rds-bundle.pem \
    && awk '/-----BEGIN CERTIFICATE-----/ {n++} n {print > ("/tmp/rds-ca-" n ".pem")}' /tmp/rds-bundle.pem \
    && for certificate in /tmp/rds-ca-*.pem; do \
         keytool -importcert -noprompt -trustcacerts \
           -alias "$(basename "$certificate" .pem)" \
           -keystore "$JAVA_HOME/lib/security/cacerts" -storepass changeit -file "$certificate" || exit 1; \
       done \
    && rm /tmp/rds-bundle.pem /tmp/rds-ca-*.pem

WORKDIR /app
COPY --chown=10001:10001 --chmod=0444 target/cart-service-1.0.0.jar app.jar
RUN mkdir -p /app/data && chown -R 10001:10001 /app
USER 10001:10001
ENV JAVA_TOOL_OPTIONS="-Xms64m -Xmx192m"
EXPOSE 8085
HEALTHCHECK --interval=20s --timeout=5s --start-period=90s --retries=5 \
    CMD curl --fail --silent http://localhost:8085/health || exit 1
ENTRYPOINT ["java", "-jar", "app.jar"]
