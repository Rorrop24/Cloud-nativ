import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MsalBroadcastService } from '@azure/msal-angular';
import { InteractionStatus } from '@azure/msal-browser';
import { filter } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from './auth/auth.service';
import { ApiService, Catalog, Profile, Cart, Receipt, Document } from './api.service';

function errorMessage(error: HttpErrorResponse): string {
  if (error.status === 401) return 'La sesion ha vencido. Inicia sesion nuevamente.';
  if (error.status === 403) return 'Tu cuenta no tiene permiso para esta operacion.';
  const message=error.error?.detail || error.error?.error;
  if(error.status===409) return typeof message==='string' ? message : 'La operacion entra en conflicto con los datos actuales. Revisa el stock y tu cuenta.';
  return typeof message==='string' ? message : 'El servicio no esta disponible. Intenta nuevamente.';
}

@Component({
  selector: 'app-root', standalone: false,
  template: `
    <header><a class="brand" routerLink="/">Punto Gamer</a>
      <nav aria-label="Principal"><a routerLink="/catalogo" routerLinkActive="active">Catalogo</a>
        <a routerLink="/carrito" routerLinkActive="active">Carrito</a><a routerLink="/documentos" routerLinkActive="active">Comprobantes</a><a routerLink="/cuenta" routerLinkActive="active">Mi cuenta</a>
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


@Component({selector:'app-catalog',standalone:false,template:`
  <div class="heading"><h1>Catalogo Punto Gamer</h1><button (click)="load()" [disabled]="loading()">Actualizar</button></div>
  @if(loading()){<p role="status">Cargando productos...</p>}
  @if(error()){<p class="error" role="alert">{{error()}}</p>}
  @if(notice()){<p class="success" role="status">{{notice()}} <a routerLink="/carrito">Ver carrito</a></p>}
  @if(data();as catalog){<p>{{catalog.resumen.totalProductos}} productos</p><div class="product-grid">
    @for(product of catalog.catalogo;track product.id){<article class="product-card">
      @if(product.imagen){<img [src]="product.imagen" alt="" loading="lazy">}@else{<div class="product-placeholder" aria-hidden="true">PG</div>}
      <h2>{{product.nombre}}</h2><p>{{product.precio | currency:'CLP':'symbol-narrow':'1.0-0'}}</p><p>Stock: {{product.stock}}</p>
      <button (click)="add(product.id)" [disabled]="busy() || product.stock < 1">Agregar al carrito</button>
    </article>}@empty{<p>No hay productos disponibles.</p>}
  </div>}`})
export class CatalogComponent implements OnInit {
  private readonly api=inject(ApiService);private readonly destroyRef=inject(DestroyRef);
  readonly loading=signal(false);readonly busy=signal(false);readonly error=signal('');readonly notice=signal('');readonly data=signal<Catalog|null>(null);
  ngOnInit(){this.load();}
  load(){this.loading.set(true);this.error.set('');this.api.catalog().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({next:data=>{this.data.set(data);this.loading.set(false);},error:(e:HttpErrorResponse)=>{this.error.set(errorMessage(e));this.loading.set(false);}});}
  add(id:string){this.busy.set(true);this.error.set('');this.api.add(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({next:()=>{this.notice.set('Producto guardado en tu carrito.');this.busy.set(false);},error:(e:HttpErrorResponse)=>{this.error.set(errorMessage(e));this.busy.set(false);}});}
}
@Component({selector:'app-cart',standalone:false,template:`
  <div class="heading"><h1>Tu carrito</h1><button (click)="load()" [disabled]="busy()">Actualizar</button></div>
  @if(error()){<p class="error" role="alert">{{error()}}</p>}
  @if(receipt();as order){<p class="success" role="status">Compra #{{order.id}} registrada por {{order.total | currency:'CLP':'symbol-narrow':'1.0-0'}}. <a routerLink="/documentos">Ver comprobante</a></p>}
  @if(cart();as current){<div class="table-wrap"><table><thead><tr><th>Producto</th><th>Precio</th><th>Cantidad</th><th>Acciones</th></tr></thead><tbody>
    @for(item of current.items;track item.id){<tr><td>{{item.nombre}}</td><td>{{item.unitPrice | currency:'CLP':'symbol-narrow':'1.0-0'}}</td><td><input #quantity type="number" min="1" [max]="item.stock" [value]="item.quantity" aria-label="Cantidad"></td><td><button (click)="update(item.id,+quantity.value)" [disabled]="busy()">Guardar cantidad</button><button class="secondary" (click)="remove(item.id)" [disabled]="busy()">Quitar</button></td></tr>}
    @empty{<tr><td colspan="4">Tu carrito esta vacio. <a routerLink="/catalogo">Ver productos</a></td></tr>}
  </tbody></table></div><p class="cart-total">Total: {{current.total | currency:'CLP':'symbol-narrow':'1.0-0'}}</p>
    <p class="muted">Compra de demostracion: registra la boleta y reserva stock; no realiza un cobro bancario.</p>
    <button (click)="checkout()" [disabled]="busy() || current.items.length===0">{{busy()?'Procesando...':'Registrar compra'}}</button>
  }`})
export class CartComponent implements OnInit {
  private readonly api=inject(ApiService);private readonly destroyRef=inject(DestroyRef);
  readonly cart=signal<Cart|null>(null);readonly busy=signal(false);readonly error=signal('');readonly receipt=signal<Receipt|null>(null);
  ngOnInit(){this.load();}
  load(){this.change(this.api.cart());}
  private change(request:ReturnType<ApiService['cart']>){this.busy.set(true);this.error.set('');request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({next:cart=>{this.cart.set(cart);this.busy.set(false);},error:(e:HttpErrorResponse)=>{this.error.set(errorMessage(e));this.busy.set(false);}});}
  update(id:string,quantity:number){this.change(this.api.quantity(id,quantity));}
  remove(id:string){this.change(this.api.remove(id));}
  checkout(){this.busy.set(true);this.error.set('');this.api.checkout().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({next:receipt=>{this.receipt.set(receipt);this.cart.set({items:[],total:0});this.busy.set(false);},error:(e:HttpErrorResponse)=>{this.error.set(errorMessage(e));this.busy.set(false);}});}
}
@Component({selector:'app-documents',standalone:false,template:`
  <div class="heading"><h1>Tus comprobantes</h1><button (click)="load()" [disabled]="loading()">Actualizar</button></div>
  <p>El comprobante se genera de forma asincrona. Actualiza unos segundos despues de comprar.</p>
  @if(error()){<p class="error" role="alert">{{error()}}</p>}
  @for(document of documents();track document.event_id){<article class="document-card"><h2>{{document.title}}</h2><p>{{document.created_at | date:'short'}}</p><button (click)="download(document.event_id)">Descargar comprobante</button></article>}
  @empty{<p>No hay comprobantes todavia.</p>}`})
export class DocumentsComponent implements OnInit {
  private readonly api=inject(ApiService);private readonly destroyRef=inject(DestroyRef);readonly documents=signal<Document[]>([]);readonly loading=signal(false);readonly error=signal('');
  ngOnInit(){this.load();}
  load(){this.loading.set(true);this.api.documents().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({next:documents=>{this.documents.set(documents);this.loading.set(false);},error:(e:HttpErrorResponse)=>{this.error.set(errorMessage(e));this.loading.set(false);}});}
  download(id:string){this.api.document(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({next:html=>{const url=URL.createObjectURL(new Blob([html],{type:'text/html'}));const link=window.document.createElement('a');link.href=url;link.download='comprobante-punto-gamer.html';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},error:(e:HttpErrorResponse)=>this.error.set(errorMessage(e))});}
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


@Component({selector:'app-admin',standalone:false,template:`
  <h1>Administracion RabbitMQ</h1><p>Gestiona recursos de prueba. Las colas y exchanges del sistema estan protegidos.</p>
  @if(error()){<p class="error" role="alert">{{error()}}</p>}
  <section class="admin-grid">
    <fieldset><legend>Colas</legend><label>Nombre<input #queue value="evidencia.ep2"></label><button (click)="run(api.createQueue(queue.value))">Crear cola</button><button (click)="run(api.queue(queue.value))">Consultar</button><button class="secondary" (click)="run(api.deleteQueue(queue.value))">Eliminar</button><button class="secondary" (click)="run(api.createQueue(''))">Probar nombre vacio (400)</button></fieldset>
    <fieldset><legend>Exchanges</legend><label>Nombre<input #exchange value="evidencia.exchange"></label><label>Tipo<select #type><option>direct</option><option>topic</option><option>fanout</option><option>headers</option></select></label><button (click)="run(api.createExchange(exchange.value,type.value))">Crear exchange</button><button class="secondary" (click)="run(api.deleteExchange(exchange.value))">Eliminar</button></fieldset>
    <fieldset><legend>Bindings</legend><label>Routing key<input #key value="evidencia.key"></label><button (click)="run(api.binding(queue.value,exchange.value,key.value))">Crear binding</button><button class="secondary" (click)="run(api.binding(queue.value,exchange.value,key.value,true))">Eliminar binding</button></fieldset>
    <fieldset><legend>Pruebas de mensajes</legend><label>Dominio<select #domain><option value="pedidos">Pedidos</option><option value="inventario">Inventario</option><option value="notificaciones">Documentos</option></select></label><button (click)="event(domain.value,'Prueba normal')">Enviar normal</button><button (click)="event(domain.value,'ERROR: prueba controlada')">Enviar error a DLQ</button><button (click)="event(domain.value,'RETRY: prueba temporal')">Probar reintentos</button></fieldset>
  </section>
  <div class="heading"><h2>Colas y resultados</h2><button (click)="run(api.topology())">Actualizar topologia</button><button (click)="run(api.movements())">Movimientos de inventario</button></div>
  @if(data()){<pre>{{data() | json}}</pre>}`})
export class AdminComponent implements OnInit {
  readonly api=inject(ApiService);private readonly destroyRef=inject(DestroyRef);readonly error=signal('');readonly data=signal<unknown>(null);
  ngOnInit(){this.run(this.api.topology());}
  run(request:import('rxjs').Observable<unknown>){this.error.set('');request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({next:data=>this.data.set(data??{status:'Operacion completada'}),error:(e:HttpErrorResponse)=>{this.error.set('HTTP '+e.status+': '+errorMessage(e));this.data.set(e.error);}});}
  event(domain:string,message:string){this.run(this.api.event(domain,'EP2-'+Date.now(),message));}
}

@Component({ selector: 'app-denied', standalone: false, template: `
  <h1>Acceso no disponible</h1><p>Tu sesion o tus permisos no permiten abrir esta pagina.</p>
  <a routerLink="/">Volver a mi cuenta</a>` })
export class DeniedComponent {}
