import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MsalBroadcastService } from '@azure/msal-angular';
import { InteractionStatus } from '@azure/msal-browser';
import { filter } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from './auth/auth.service';
import { ApiService, Catalog, Profile } from './api.service';

function errorMessage(error: HttpErrorResponse): string {
  if (error.status === 401) return 'La sesion ha vencido. Inicia sesion nuevamente.';
  if (error.status === 403) return 'Tu cuenta no tiene permiso para esta operacion.';
  if (error.status === 409) return 'Esta cuenta requiere vinculacion por un administrador.';
  return 'El servicio no esta disponible. Intenta nuevamente.';
}

@Component({
  selector: 'app-root', standalone: false,
  template: `
    <header><a class="brand" routerLink="/">Punto Gamer</a>
      <nav aria-label="Principal"><a routerLink="/catalogo" routerLinkActive="active">Catalogo</a>
        <a routerLink="/cuenta" routerLinkActive="active">Mi cuenta</a>
        <a routerLink="/administracion" routerLinkActive="active">Administracion</a></nav>
      @if (auth.account()) { <button class="secondary" (click)="auth.logout()">Cerrar sesion</button> }
      @else { <button (click)="auth.login()">Iniciar sesion</button> }
    </header>
    <main>@if (auth.error()) { <p class="error" role="alert">{{ auth.error() }}</p> }<router-outlet /></main>
    <footer>Punto Gamer</footer>
  `,
})
export class AppComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly broadcast = inject(MsalBroadcastService);
  private readonly destroyRef = inject(DestroyRef);
  ngOnInit(): void {
    this.broadcast.inProgress$.pipe(filter(status => status === InteractionStatus.None),
      takeUntilDestroyed(this.destroyRef)).subscribe(() => this.auth.refreshAccount());
  }
}

@Component({ selector: 'app-home', standalone: false, template: `
  <section><p class="eyebrow">PUNTO GAMER</p><h1>Mi cuenta</h1>
    @if (auth.account(); as account) {
      <p>Hola, {{ account.name || account.username }}.</p>
      <div class="links"><a routerLink="/catalogo">Ver catalogo</a><a routerLink="/cuenta">Ver mi perfil</a></div>
    } @else { <p>Sesion cerrada</p><button (click)="auth.login()">Iniciar sesion</button> }
  </section>` })
export class HomeComponent { readonly auth = inject(AuthService); }

@Component({ selector: 'app-catalog', standalone: false, template: `
  <div class="heading"><h1>Catalogo</h1><button class="secondary" (click)="load()" [disabled]="loading()">Actualizar</button></div>
  @if (loading()) { <p role="status">Cargando catalogo...</p> }
  @else if (error()) { <p class="error" role="alert">{{ error() }}</p> }
  @else if (data(); as catalog) {
    <p class="muted">{{ catalog.resumen.totalProductos }} productos</p>
    <div class="table-wrap"><table><thead><tr><th>Producto</th><th>Precio</th><th>Stock</th></tr></thead><tbody>
      @for (product of catalog.catalogo; track product.id) {
        <tr><td><div class="product">@if (product.imagen) { <img [src]="product.imagen" alt="" loading="lazy"> }
          <span>{{ product.nombre }}</span></div></td><td>{{ product.precio | currency:'CLP':'symbol-narrow':'1.0-0' }}</td><td>{{ product.stock }}</td></tr>
      } @empty { <tr><td colspan="3">No hay productos disponibles.</td></tr> }
    </tbody></table></div>
  }` })
export class CatalogComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly data = signal<Catalog | null>(null);
  ngOnInit(): void { this.load(); }
  load(): void {
    this.loading.set(true); this.error.set('');
    this.api.catalog().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => { this.data.set(data); this.loading.set(false); },
      error: (error: HttpErrorResponse) => { this.error.set(errorMessage(error)); this.loading.set(false); },
    });
  }
}

@Component({ selector: 'app-profile', standalone: false, template: `
  <div class="heading"><h1>Mi perfil</h1><button class="secondary" (click)="load()" [disabled]="loading()">Actualizar</button></div>
  @if (loading()) { <p role="status">Cargando perfil...</p> }
  @else if (error()) { <p class="error" role="alert">{{ error() }}</p> }
  @else if (profile(); as user) {
    <dl><dt>Nombre</dt><dd>{{ user.nombre }} {{ user.apellido }}</dd><dt>Correo</dt><dd>{{ user.email }}</dd></dl>
    <h2>Accesos</h2><p>{{ auth.claims()?.roles?.join(', ') || 'Cliente' }}</p>
  }` })
export class ProfileComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  readonly profile = signal<Profile | null>(null);
  readonly error = signal('');
  readonly loading = signal(false);
  ngOnInit(): void { this.load(); }
  load(): void {
    this.loading.set(true); this.error.set('');
    this.api.profile().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: profile => { this.profile.set(profile); this.loading.set(false); },
      error: (error: HttpErrorResponse) => { this.error.set(errorMessage(error)); this.loading.set(false); },
    });
  }
}

@Component({ selector: 'app-admin', standalone: false, template: `
  <h1>Mensajeria</h1>
  <form (submit)="load(queue.value); $event.preventDefault()">
    <label for="queue">Cola</label><div class="query"><input #queue id="queue" value="pedidos.queue" required pattern="[a-zA-Z0-9._-]+" maxlength="100">
      <button [disabled]="loading()">Consultar</button></div>
  </form>
  @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
  @if (loading()) { <p role="status">Consultando...</p> }
  @if (data()) { <pre>{{ data() | json }}</pre> }` })
export class AdminComponent {
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly data = signal<Record<string, unknown> | null>(null);
  load(name: string): void {
    this.loading.set(true); this.error.set(''); this.data.set(null);
    this.api.queue(name).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => { this.data.set(data); this.loading.set(false); },
      error: (error: HttpErrorResponse) => { this.error.set(errorMessage(error)); this.loading.set(false); },
    });
  }
}

@Component({ selector: 'app-denied', standalone: false, template: `
  <h1>Acceso no disponible</h1><p>Tu sesion o tus permisos no permiten abrir esta pagina.</p>
  <a routerLink="/">Volver a mi cuenta</a>` })
export class DeniedComponent {}
