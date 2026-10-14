import { InteractionType } from '@azure/msal-browser';
import { MsalGuardConfiguration, MsalInterceptorConfiguration } from '@azure/msal-angular';
import { AppConfig } from '../app-config';

export function guardConfig(config: AppConfig): MsalGuardConfiguration {
  return {
    interactionType: InteractionType.Redirect,
    authRequest: { scopes: [config.apiScope] },
    loginFailedRoute: '/acceso-denegado',
  };
}

export function interceptorConfig(config: AppConfig): MsalInterceptorConfiguration {
  return {
    strictMatching: true,
    interactionType: InteractionType.Redirect,
    protectedResourceMap: new Map([
      [config.bffUrl + '/*', [config.apiScope]],
      [config.backendUrl + '/*', [config.apiScope]],
      ...[config.cartUrl,config.adminUrl,config.notificationsUrl,config.inventoryUrl].filter((url): url is string => !!url).map(url => [url + '/*', [config.apiScope]] as [string,string[]]),
    ]),
  };
}
