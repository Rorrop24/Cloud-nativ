# Punto Gamer: base Angular

Proyecto independiente. No reemplaza la tienda de `../Frontend`.
Incluye AppModule, MSAL, MsalInterceptor, MsalGuard, guard de roles/scopes,
catalogo, perfil y consulta administrativa de colas.

## Ejecutar

Requiere Node 24.15+ de la rama 24, o una version compatible declarada en package.json.

```powershell
npm ci
npm start
```

Abrir http://127.0.0.1:4200/. El login redirige a Azure: registra esta URL
como redirect URI de tipo SPA antes de iniciar sesion.

Editar `public/config.json`: tenantId, clientId, apiScope, bffUrl y backendUrl.
Son valores publicos, nunca un client secret. Las APIs remotas requieren HTTPS.
El BFF Java usa por defecto 8084 y el backend 8082.

```powershell
npm run build
npm test
```

El resultado de produccion esta en `dist/punto-gamer/browser`.
El hosting debe devolver index.html para las rutas de Angular y servir config.json.
La guia completa de Azure, Oracle y AWS esta en `../docs/autenticacion-y-bff.md`.
