import { NgModule, provideZonelessChangeDetection, LOCALE_ID } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeEsCL from '@angular/common/locales/es-CL';
registerLocaleData(localeEsCL);
import { BrowserModule } from '@angular/platform-browser';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { RouterModule, Routes } from '@angular/router';
import { MsalModule, MsalGuard, MsalService, MsalBroadcastService, MsalInterceptor,
  MsalRedirectComponent, MSAL_GUARD_CONFIG, MSAL_INTERCEPTOR_CONFIG } from '@azure/msal-angular';
import { APP_CONFIG } from './app-config';
import { guardConfig, interceptorConfig } from './auth/msal.config';
import { accessGuard } from './auth/access.guard';
import { IconComponent } from './icons.component';
import { AppComponent, HomeComponent, CatalogComponent, CartComponent, DocumentsComponent, ProfileComponent, AdminComponent, DeniedComponent } from './pages';

const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'catalogo', component: CatalogComponent, canActivate: [MsalGuard, accessGuard], data: { scopes: ['Pedidos.Read'] } },
  { path: 'carrito', component: CartComponent, canActivate: [MsalGuard, accessGuard], data: { scopes: ['Pedidos.Read'] } },
  { path: 'documentos', component: DocumentsComponent, canActivate: [MsalGuard, accessGuard], data: { scopes: ['Pedidos.Read'] } },
  { path: 'cuenta', component: ProfileComponent, canActivate: [MsalGuard, accessGuard], data: { scopes: ['Pedidos.Read'] } },
  { path: 'administracion', component: AdminComponent, canActivate: [MsalGuard, accessGuard], data: { roles: ['Rabbit.Admin'] } },
  { path: 'acceso-denegado', component: DeniedComponent },
  { path: '**', redirectTo: '' },
];

@NgModule({
  declarations: [IconComponent, AppComponent, HomeComponent, CatalogComponent, CartComponent, DocumentsComponent, ProfileComponent, AdminComponent, DeniedComponent],
  imports: [BrowserModule, MsalModule, RouterModule.forRoot(routes)],
  providers: [
    { provide: LOCALE_ID, useValue: 'es-CL' },
    provideZonelessChangeDetection(),
    provideHttpClient(withInterceptorsFromDi()),
    { provide: HTTP_INTERCEPTORS, useClass: MsalInterceptor, multi: true },
    { provide: MSAL_GUARD_CONFIG, useFactory: guardConfig, deps: [APP_CONFIG] },
    { provide: MSAL_INTERCEPTOR_CONFIG, useFactory: interceptorConfig, deps: [APP_CONFIG] },
    MsalService, MsalGuard, MsalBroadcastService,
  ],
  bootstrap: [AppComponent, MsalRedirectComponent],
})
export class AppModule {}
