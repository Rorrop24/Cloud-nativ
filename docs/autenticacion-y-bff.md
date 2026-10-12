# Punto Gamer: autenticacion, BFF y persistencia

## Componentes y alcance

- `Frontend/`: tienda React conservada. MSAL renueva el access token para las APIs
  configuradas y las rutas administrativas exigen el rol del token de la API.
- `FrontendAngular/`: base independiente Angular 22 con AppModule,
  MsalInterceptor, MsalGuard y un guard adicional de roles/scopes.
- `BffJava/`: BFF Spring Boot en 8084. Valida JWT antes de agregar o reenviar datos.
- `Backend/`: API existente en 8082, JPA/Oracle y RabbitMQ. Tambien valida el JWT.
- `infra/terraform/`: infraestructura RabbitMQ ya preparada. No fue desplegada
  ni ampliada para provisionar estos servicios, API Gateway, Azure u Oracle.

Flujo Angular:

```text
Angular --MSAL/PKCE--> Azure Entra ID
Angular --Bearer JWT--> BFF Java --mismo Bearer--> Backend --JPA--> Oracle Cloud
                                                    +--> RabbitMQ
```

React puede seguir consumiendo /v2 y /api directamente en desarrollo.
El BFF Node antiguo se conserva, pero la entrada recomendada es BffJava.
Esta es una base ejecutable, no una migracion completa de la tienda a Angular.

## Configurar Azure

1. Usar una aplicacion Entra de tipo SPA para React/Angular y otra que representa
   la API. Nunca poner un client secret en un frontend.
2. Registrar las redirect URIs exactas que se vayan a usar:
   http://localhost:5173/, http://127.0.0.1:5173/,
   http://localhost:4200/ y http://127.0.0.1:4200/.
   React usa window.location.origin sin barra explicita; verificar tambien
   que coincida con la configuracion aceptada por el portal.
3. En la aplicacion API, establecer `api.requestedAccessTokenVersion: 2`.
   Exponer el scope delegado `Pedidos.Read` y conceder permiso/consentimiento a la SPA.
   Se conserva este nombre tecnico para no romper tu registro Azure existente.
4. Crear el app role `Rabbit.Admin` en la aplicacion API, habilitado para usuarios,
   y asignarlo al administrador desde la aplicacion empresarial correspondiente.
   Los roles de la base de datos o del ID token de la SPA no otorgan permisos a la API.
5. Agregar el claim opcional `email` al access token de la aplicacion API si
   `preferred_username` no esta presente. Se usa solo como dato de perfil.
   La identidad estable es `tid:oid`, nunca el email enviado por el navegador.
6. Actualizar `FrontendAngular/public/config.json` y las variables VITE_AZURE_*
   del frontend React. Actualizar ambos servicios Java con:

```text
AZURE_ISSUER_URI=https://login.microsoftonline.com/<tenant-id>/v2.0
AZURE_JWK_SET_URI=https://login.microsoftonline.com/<tenant-id>/discovery/v2.0/keys
AZURE_API_AUDIENCE=<client-id de la aplicacion API, no de la SPA>
ALLOWED_ORIGINS=https://<dominio-real-del-frontend>
```

Los identificadores iniciales son los que ya tenia el proyecto. No se ha comprobado
la configuracion de esas aplicaciones en el tenant ni se han cambiado sus permisos.
El frontend interpreta claims para mostrar/ocultar vistas; eso no verifica una firma
ni sustituye la autorizacion del servidor.

Referencias: [configuracion MSAL Angular](https://learn.microsoft.com/en-us/entra/msal/javascript/angular/initialization),
[claims de access tokens](https://learn.microsoft.com/en-us/entra/identity-platform/access-token-claims-reference),
[claims opcionales](https://learn.microsoft.com/en-us/entra/identity-platform/optional-claims).

## Seguridad Java

`AzureJwtConfiguration.java` usa NimbusJwtDecoder/JWKS y acepta RS256.
`ApiTokenValidator.java` exige sujeto y expiracion, comprueba vigencia
sin tolerancia de reloj, issuer exacto y que audience contenga la API esperada.
Sincronizar los relojes de las instancias.

`SecurityConfig.java` instala el filtro oficial BearerTokenAuthenticationFilter:
no hay un filtro artesanal ni una clave JWT fija. Los archivos JwtFilter/JwtUtil
anteriores quedaron como referencias vacias, sin clases ejecutables.
La rotacion de claves publicas la maneja Nimbus.

- Sin bearer o token invalido: 401; firma, issuer, audience o vigencia incorrectos
  nunca autorizan la solicitud.
- Token valido sin rol/scope requerido: 403.
- Colas y simulaciones: rol Rabbit.Admin.
- Escritura de productos/categorias y administracion de usuarios: Rabbit.Admin.
- Catalogo GET del backend: publico, para conservar la tienda sin login.
- Carrito, perfil y boletas: scope Pedidos.Read o rol Rabbit.Admin; adicionalmente
  `UsuarioAccess` verifica propiedad por la identidad Azure persistida.
- El endpoint de login local anterior esta bloqueado. No se aceptan sus tokens HS256.

CORS usa solo origins configurados, sin wildcard ni cookies de autenticacion.
Las resenas publicas devuelven un DTO con nombre, puntuacion, texto y fecha,
sin el objeto Usuario ni su correo, RUT, identidad Azure o hash.
CSRF desactivado corresponde a APIs stateless con bearer, no a sesiones con cookies.

Referencia: [Spring Security JWT Resource Server](https://docs.spring.io/spring-security/reference/6.5/servlet/oauth2/resource-server/jwt.html).

## Oracle Cloud

La entidad de ejemplo es `Backend/src/main/java/cl/tiendalevelup/Entity/Usuario.java`
y su repositorio es `Repository/UsuarioRepository.java`.
La sincronizacion Azure se implementa en `Service/AzureUsuarioService.java`.
Los hashes de contrasena son write-only y nunca se serializan en respuestas.

1. Respaldar y aplicar una sola vez `Backend/src/main/resources/db/azure-identity-oracle.sql`
   para agregar azure_subject y su restriccion unica. No se ejecuto esta migracion.
2. Si el correo ya existe sin vinculacion Azure, la sincronizacion devuelve 409.
   Un administrador debe verificar tenant/object ID y vincular ese usuario.
   No se vincula automaticamente una cuenta antigua por un email editable.
3. Montar el wallet Oracle fuera de Git y configurar DB_URL, DB_USERNAME y DB_PASSWORD.
   Mantener conectividad y permisos del usuario de BD limitados a lo necesario.
4. Activar SPRING_PROFILES_ACTIVE=cloud: ddl-auto=validate. Las modificaciones de
   esquema deben aplicarse por migraciones revisadas, no por Hibernate en produccion.

Ejemplo de URL: `jdbc:oracle:thin:@tiendalevelup_low?TNS_ADMIN=/home/ubuntu/Wallet_tiendalevelup`.
Los ejemplos .env no son cargados automaticamente por Java; exportarlos en el
entorno del proceso o usar un EnvironmentFile protegido de systemd.
Guardar los secretos en SSM Parameter Store/Secrets Manager, no en user_data,
Git, Terraform tfvars ni archivos de estado.

Los campos obligatorios heredados que no entrega Azure tienen valores provisionales
al crear un perfil (RUT temporal, fecha/ubicacion). Completar esos datos antes de un
uso comercial. Esa inicializacion no reemplaza la validacion de un perfil de compra.

## Desarrollo y pruebas

Requisitos: JDK 17+ y Node compatible con package.json.

```powershell
# En Backend y luego en BffJava
./mvnw.cmd test
./mvnw.cmd package

# En FrontendAngular
npm ci
npm test
npm run build
npm start

# En Frontend
npm ci
npm run test -- --run src/auth/apiFetch.test.js
npm run build
```

Los tests Java usan claves RSA de prueba y JWKS servido localmente.
El backend usa H2 solo en tests, sin Oracle ni RabbitMQ activos.
El BFF arranca sin base de datos y consulta el backend solo al recibir solicitudes
autorizadas. `GET /health` solo confirma que el proceso responde.
No se ha probado el login/logout completo en Azure, la conexion Oracle real,
la disponibilidad del cluster o el despliegue AWS.

## EC2 y API Gateway

Preparacion de despliegue, pendiente de conectar/provisionar por tu cuenta:

1. Empaquetar ambos JAR y ejecutarlos con Java 17+ como servicios systemd con
   usuario sin privilegios. Dar acceso saliente HTTPS a Azure para obtener JWKS.
2. Usar API Gateway HTTP API con integracion privada VPC Link a un ALB interno.
   El ALB envia /api/bff/* y /bff/* al BFF 8084; /v2/* y /api/* al backend 8082
   cuando la tienda React o endpoints no agregados lo requieran.
   Priorizar la regla /api/bff/* antes de la regla general /api/*.
3. Restringir los security groups: puertos Java solo desde el ALB y/o BFF
   segun la ruta necesaria, Oracle desde el backend y AMQP desde productores/
   consumidores autorizados. No abrir 8082/8084 ni Rabbit Admin a Internet.
4. Terminar TLS con un certificado ACM, conservar Authorization y los paths
   esperados; evitar que el nombre del stage se agregue al path de la integracion.
   Mantener limites de peticiones y logs sin JWT, contrasenas o datos sensibles.
5. Un authorizer JWT de Gateway puede ser una defensa adicional, pero los dos
   servicios siguen verificando el JWT. No confiar en headers de identidad del cliente.
   Configurar CORS en un solo punto de la capa publica para evitar headers duplicados.
6. Servir el frontend con HTTPS y actualizar origins, redirects y URLs de API.
   El backend URL del BFF debe ser una direccion interna conocida, no una URL del usuario.

Referencia: [integraciones privadas de API Gateway HTTP API](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-private.html).

## Git

Se incluyen .gitignore por componente. Se ignoran node_modules, dist, target,
cache Angular, archivos .env locales, wallets, certificados privados, estado/planes
Terraform y logs. Se conservan ejemplos sin secretos, wrappers Maven y lockfiles.
No ejecutar git add de wallets o configuraciones reales con force.
