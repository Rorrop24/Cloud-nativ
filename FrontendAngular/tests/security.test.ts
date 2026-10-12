import '@angular/compiler';
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { Injector, runInInjectionContext } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { HttpHandler, HttpRequest, HttpResponse } from '@angular/common/http';
import { MsalBroadcastService, MsalInterceptor, MsalService } from '@azure/msal-angular';
import { AuthenticationResult } from '@azure/msal-browser';
import { firstValueFrom, of } from 'rxjs';
import { interceptorConfig } from '../src/app/auth/msal.config.js';
import { AuthService } from '../src/app/auth/auth.service.js';
import { accessGuard } from '../src/app/auth/access.guard.js';

test('MsalInterceptor attaches the API JWT to both Java services, never another origin', async () => {
  const config = interceptorConfig({ tenantId: '', clientId: '', apiScope: 'api://test/Pedidos.Read',
    bffUrl: 'https://bff.example.test', backendUrl: 'https://backend.example.test' });
  const noop = () => {};
  let acquisitions = 0;
  const auth = {
    instance: { getActiveAccount: () => ({ homeAccountId: 'test' }), getAllAccounts: () => [] },
    getLogger: () => ({ verbose: noop, info: noop, infoPii: noop, warning: noop, error: noop }),
    acquireTokenSilent: (request: { scopes: string[] }) => {
      acquisitions++;
      assert.deepEqual(request.scopes, ['api://test/Pedidos.Read']);
      return of({ accessToken: 'verified-api-token' } as AuthenticationResult);
    },
  } as unknown as MsalService;
  const location = { normalize: (url: string) => url } as unknown as Location;
  const document = { createElement: () => ({ href: '' }) } as unknown as Document;
  const interceptor = new MsalInterceptor(config, auth, location, {} as MsalBroadcastService, document);
  for (const url of ['https://bff.example.test/api/bff/profile', 'https://backend.example.test/v2/usuarios/todos']) {
    const handler = { handle: (request: HttpRequest<unknown>) => {
      assert.equal(request.headers.get('Authorization'), 'Bearer verified-api-token');
      return of(new HttpResponse({ status: 200 }));
    } } as HttpHandler;
    await firstValueFrom(interceptor.intercept(new HttpRequest('GET', url), handler));
  }
  const handler = { handle: (request: HttpRequest<unknown>) => {
    assert.equal(request.headers.has('Authorization'), false);
    return of(new HttpResponse({ status: 200 }));
  } } as HttpHandler;
  await firstValueFrom(interceptor.intercept(new HttpRequest('GET', 'https://bff.example.test.attacker.test/api'), handler));
  assert.equal(acquisitions, 2);
});

async function checkGuard(roles: string[], scopes: string[], required: Record<string, unknown>, failure = false) {
  const denied = { url: '/acceso-denegado' };
  const injector = Injector.create({ providers: [
    { provide: AuthService, useValue: { accessClaims: async () => {
      if (failure) throw new Error('No token');
      return { roles, scopes, exp: Date.now() / 1000 + 60 };
    } } },
    { provide: Router, useValue: { createUrlTree: () => denied } },
  ] });
  return runInInjectionContext(injector, () => accessGuard(
    { data: required } as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
}

test('role guard grants only the required API role', async () => {
  assert.equal(await checkGuard(['Rabbit.Admin'], [], { roles: ['Rabbit.Admin'] }), true);
  assert.deepEqual(await checkGuard([], ['Pedidos.Read'], { roles: ['Rabbit.Admin'] }), { url: '/acceso-denegado' });
});

test('scope guard and failed token acquisition redirect to access denied', async () => {
  assert.equal(await checkGuard([], ['Pedidos.Read'], { scopes: ['Pedidos.Read'] }), true);
  assert.deepEqual(await checkGuard([], [], { scopes: ['Pedidos.Read'] }), { url: '/acceso-denegado' });
  assert.deepEqual(await checkGuard([], [], {}, true), { url: '/acceso-denegado' });
});
