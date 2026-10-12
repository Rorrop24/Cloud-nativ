import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { PublicClientApplication, BrowserCacheLocation } from '@azure/msal-browser';
import { MSAL_INSTANCE } from '@azure/msal-angular';
import { APP_CONFIG, AppConfig, validateConfig } from './app/app-config';
import { AppModule } from './app/app.module';

async function bootstrap(): Promise<void> {
  const response = await fetch('/config.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('No se pudo cargar config.json');
  const config = validateConfig(await response.json() as AppConfig);
  const instance = new PublicClientApplication({
    auth: {
      clientId: config.clientId,
      authority: `https://login.microsoftonline.com/${config.tenantId}`,
      redirectUri: window.location.origin + '/',
      postLogoutRedirectUri: window.location.origin + '/',
    },
    cache: { cacheLocation: BrowserCacheLocation.SessionStorage },
    system: { loggerOptions: { piiLoggingEnabled: false } },
  });
  await instance.initialize();
  await platformBrowserDynamic([
    { provide: APP_CONFIG, useValue: config },
    { provide: MSAL_INSTANCE, useValue: instance },
  ]).bootstrapModule(AppModule);
}

bootstrap().catch(() => {
  const root = document.querySelector('app-root');
  if (root) root.textContent = 'No se pudo iniciar Punto Gamer. Intenta nuevamente.';
});
