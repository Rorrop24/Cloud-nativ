# Punto Gamer: BFF Java

Spring Boot 3.5.8, Java 17+. Servicio independiente del BFF Node anterior,
que se conserva en `../bff-service` pero no proporciona estas garantias de JWT.
No desplegar ese servicio antiguo como entrada de confianza.

```powershell
./mvnw.cmd test
./mvnw.cmd package
java -jar target/punto-gamer-bff-1.0.0.jar
```

El servicio escucha en 8084. Exportar variables de `.env.example` en el
entorno del proceso; Spring no carga ese archivo automaticamente.

- GET /health: comprobacion basica de proceso; no verifica la salud de Oracle/RabbitMQ.
- GET /api/bff/catalogo-completo y /bff/home-data: agregacion del catalogo.
- POST /api/bff/profile: sincroniza el perfil usando solo el JWT verificado.
- GET /api/bff/me: sujeto y authorities, sin exponer el token.
- GET /api/bff/admin/queues/{name}: consulta de cola; requiere Rabbit.Admin.

Los endpoints de usuario requieren Pedidos.Read o Rabbit.Admin. El bearer
original se reenvia al backend, que vuelve a verificarlo. No se usan headers
X-User/X-Roles ni credenciales compartidas. Los errores de backend no se ocultan
como catalogos vacios: 4xx conserva el codigo, 5xx se traduce a 502 y timeout a 504.

Despliegue y configuracion: `../docs/autenticacion-y-bff.md`.
