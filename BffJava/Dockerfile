FROM eclipse-temurin:21-jre-jammy
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY target/punto-gamer-bff-1.0.0.jar app.jar
USER 10001:10001
ENV JAVA_TOOL_OPTIONS="-Xms128m -Xmx512m"
EXPOSE 8084
HEALTHCHECK --interval=20s --timeout=5s --start-period=60s --retries=5 \
    CMD curl --fail --silent http://localhost:8084/health || exit 1
ENTRYPOINT ["java", "-jar", "app.jar"]
