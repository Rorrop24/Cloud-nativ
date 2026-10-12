import { InjectionToken } from '@angular/core';

export interface AppConfig {
  tenantId: string;
  clientId: string;
  apiScope: string;
  bffUrl: string;
  backendUrl: string;
}

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');

export function validateConfig(value: AppConfig): AppConfig {
  const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
  if (!uuid.test(value.tenantId) || !uuid.test(value.clientId) || !value.apiScope?.startsWith('api://')) {
    throw new Error('Configuracion Azure incompleta');
  }
  for (const field of ['bffUrl', 'backendUrl'] as const) {
    const url = new URL(value[field]);
    const local = ['localhost', '127.0.0.1'].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash ||
        (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) {
      throw new Error('Las APIs remotas requieren HTTPS');
    }
    value[field] = url.toString().replace(/\/$/, '');
  }
  return value;
}
