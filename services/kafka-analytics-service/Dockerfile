FROM eclipse-temurin:21-jre-jammy

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Este servicio solo habla con Kafka y valida JWT: no recibe credenciales de RDS ni RabbitMQ.
WORKDIR /app
COPY --chown=10001:10001 --chmod=0444 target/kafka-analytics-service-1.0.0.jar app.jar
USER 10001:10001
ENV JAVA_TOOL_OPTIONS="-Xms64m -Xmx192m"
EXPOSE 8090
HEALTHCHECK --interval=20s --timeout=5s --start-period=90s --retries=5 \
    CMD curl --fail --silent http://localhost:8090/health || exit 1
ENTRYPOINT ["java", "-jar", "app.jar"]
