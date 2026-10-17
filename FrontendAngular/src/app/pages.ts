import { Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { MsalBroadcastService } from '@azure/msal-angular';
import { InteractionStatus } from '@azure/msal-browser';
import { filter, finalize, Observable } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from './auth/auth.service';
import { ApiService, Catalog, Profile, Cart, Receipt, Document, Topology, PublishedEvent } from './api.service';
import { finalPrice, productArt, selectProducts } from './catalog-utils';

function errorMessage(error:HttpErrorResponse):string {
  if(error.status===401)return 'Tu sesión venció. Vuelve a iniciar sesión para continuar.';
  if(error.status===403)return 'Tu cuenta no tiene permiso para realizar esta acción.';
  const message=error.error?.detail || error.error?.error;
  return typeof message==='string'?message:error.status===409?'Revisa el stock y vuelve a intentarlo.':'No pudimos conectar con el servicio. Intenta nuevamente.';
}

@Component({selector:'app-root',standalone:false,templateUrl:'./ui/shell.html'})
export class AppComponent implements OnInit {
  readonly auth=inject(AuthService); readonly api=inject(ApiService);
  private readonly broadcast=inject(MsalBroadcastService); private readonly destroyRef=inject(DestroyRef);
  ngOnInit(){this.broadcast.inProgress$.pipe(filter(s=>s===InteractionStatus.None),takeUntilDestroyed(this.destroyRef)).subscribe(()=>{this.auth.refreshAccount();if(!this.auth.account())this.api.cartCount.set(null);});}
}

@Component({selector:'app-home',standalone:false,templateUrl:'./ui/home.html'})
export class HomeComponent { readonly auth=inject(AuthService); }

@Component({selector:'app-catalog',standalone:false,templateUrl:'./ui/catalog.html'})
export class CatalogComponent implements OnInit {
  private readonly api=inject(ApiService);private readonly destroyRef=inject(DestroyRef);private readonly route=inject(ActivatedRoute);
  readonly loading=signal(true);readonly busy=signal('');readonly error=signal('');readonly notice=signal('');readonly data=signal<Catalog|null>(null);
  readonly search=signal('');readonly category=signal('');readonly stockOnly=signal(false);readonly sort=signal('relevance');
  readonly categories=computed(()=>[...new Set((this.data()?.catalogo??[]).map(p=>p.categoria?.nombre).filter((n):n is string=>!!n))].sort((a,b)=>a.localeCompare(b,'es')));
  readonly products=computed(()=>selectProducts(this.data()?.catalogo??[],this.search(),this.category(),this.stockOnly(),this.sort()));
  readonly total=computed(()=>this.data()?.catalogo.length??0);readonly price=finalPrice;readonly art=productArt;
  ngOnInit(){this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(p=>{this.search.set(p.get('q')??'');this.category.set(p.get('categoria')??'');});this.load();}
  load(){this.loading.set(true);this.error.set('');this.api.catalog().pipe(finalize(()=>this.loading.set(false)),takeUntilDestroyed(this.destroyRef)).subscribe({next:data=>this.data.set(data),error:e=>this.error.set(errorMessage(e))});}
  reset(){this.search.set('');this.category.set('');this.stockOnly.set(false);this.sort.set('relevance');}
  imageError(event:Event,id:string){const img=event.target as HTMLImageElement;img.onerror=null;img.src=this.art(this.data()!.catalogo.find(p=>p.id===id)!);}
  add(id:string){this.busy.set(id);this.notice.set('');this.error.set('');this.api.add(id).pipe(finalize(()=>this.busy.set('')),takeUntilDestroyed(this.destroyRef)).subscribe({next:()=>this.notice.set('Producto agregado a tu carrito.'),error:e=>this.error.set(errorMessage(e))});}
}

@Component({selector:'app-cart',standalone:false,templateUrl:'./ui/cart.html'})
export class CartComponent implements OnInit {
  private readonly api=inject(ApiService);private readonly destroyRef=inject(DestroyRef);
  readonly cart=signal<Cart|null>(null);readonly busy=signal(false);readonly error=signal('');readonly receipt=signal<Receipt|null>(null);readonly art=productArt;
  readonly count=computed(()=>this.cart()?.items.reduce((sum,item)=>sum+item.quantity,0)??0);
  ngOnInit(){this.load();}load(){this.change(this.api.cart());}
  private change(request:Observable<Cart>){this.busy.set(true);this.error.set('');request.pipe(finalize(()=>this.busy.set(false)),takeUntilDestroyed(this.destroyRef)).subscribe({next:cart=>this.cart.set(cart),error:e=>this.error.set(errorMessage(e))});}
  update(id:string,quantity:number){if(!Number.isInteger(quantity)||quantity<1||quantity>100){this.error.set('Ingresa una cantidad entre 1 y 100.');return;}this.change(this.api.quantity(id,quantity));}
  remove(id:string){this.change(this.api.remove(id));}
  checkout(){this.busy.set(true);this.error.set('');this.api.checkout().pipe(finalize(()=>this.busy.set(false)),takeUntilDestroyed(this.destroyRef)).subscribe({next:receipt=>{this.receipt.set(receipt);this.cart.set({items:[],total:0});},error:e=>this.error.set(errorMessage(e))});}
}

@Component({selector:'app-documents',standalone:false,templateUrl:'./ui/documents.html'})
export class DocumentsComponent implements OnInit {
  private readonly api=inject(ApiService);private readonly destroyRef=inject(DestroyRef);
  readonly documents=signal<Document[]>([]);readonly loading=signal(true);readonly downloading=signal('');readonly error=signal('');
  ngOnInit(){this.load();}
  load(){this.loading.set(true);this.error.set('');this.api.documents().pipe(finalize(()=>this.loading.set(false)),takeUntilDestroyed(this.destroyRef)).subscribe({next:d=>this.documents.set(d),error:e=>this.error.set(errorMessage(e))});}
  download(id:string){this.downloading.set(id);this.api.document(id).pipe(finalize(()=>this.downloading.set('')),takeUntilDestroyed(this.destroyRef)).subscribe({next:html=>{const url=URL.createObjectURL(new Blob([html],{type:'text/html'}));const link=window.document.createElement('a');link.href=url;link.download='comprobante-punto-gamer.html';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},error:e=>this.error.set(errorMessage(e))});}
}

@Component({selector:'app-profile',standalone:false,templateUrl:'./ui/profile.html'})
export class ProfileComponent implements OnInit {
  readonly auth=inject(AuthService);private readonly api=inject(ApiService);private readonly destroyRef=inject(DestroyRef);
  readonly profile=signal<Profile|null>(null);readonly error=signal('');readonly loading=signal(true);
  ngOnInit(){this.load();}load(){this.loading.set(true);this.error.set('');this.api.profile().pipe(finalize(()=>this.loading.set(false)),takeUntilDestroyed(this.destroyRef)).subscribe({next:p=>this.profile.set(p),error:e=>this.error.set(errorMessage(e))});}
}

@Component({selector:'app-admin',standalone:false,templateUrl:'./ui/admin.html'})
export class AdminComponent implements OnInit {
  readonly api=inject(ApiService);private readonly destroyRef=inject(DestroyRef);
  readonly tab=signal('overview');readonly error=signal('');readonly notice=signal('');readonly busy=signal(false);readonly loading=signal(false);
  readonly topology=signal<Topology|null>(null);readonly result=signal<unknown>(null);readonly lastEvent=signal<PublishedEvent|null>(null);readonly updated=signal<Date|null>(null);
  readonly messages=computed(()=>this.topology()?.queues.reduce((s,q)=>s+q.messages,0)??0);
  readonly consumers=computed(()=>this.topology()?.queues.reduce((s,q)=>s+q.consumers,0)??0);
  readonly deadLetters=computed(()=>this.topology()?.queues.filter(q=>q.name.endsWith('.dlq')).reduce((s,q)=>s+q.messages,0)??0);
  ngOnInit(){this.refresh();}
  refresh(){this.loading.set(true);this.error.set('');this.api.topology().pipe(finalize(()=>this.loading.set(false)),takeUntilDestroyed(this.destroyRef)).subscribe({next:t=>{this.topology.set(t);this.updated.set(new Date());},error:e=>this.error.set(errorMessage(e))});}
  run(request:Observable<unknown>,message='Operación completada'){this.busy.set(true);this.notice.set('');this.error.set('');request.pipe(finalize(()=>this.busy.set(false)),takeUntilDestroyed(this.destroyRef)).subscribe({next:data=>{this.result.set(data??{resultado:message});this.notice.set(message);this.refresh();},error:(e:HttpErrorResponse)=>{this.error.set('HTTP '+e.status+' · '+errorMessage(e));this.result.set(e.error);}});}
  event(domain:string,mode:string){const message=mode==='error'?'ERROR: prueba controlada':mode==='retry'?'RETRY: prueba temporal':'Prueba normal';this.busy.set(true);this.error.set('');this.notice.set('');this.api.event(domain,'EP2-'+Date.now(),message).pipe(finalize(()=>this.busy.set(false)),takeUntilDestroyed(this.destroyRef)).subscribe({next:e=>{this.lastEvent.set(e);this.result.set(e);this.notice.set('Publicación confirmada por RabbitMQ. Comprueba el procesamiento en los logs.');this.refresh();},error:e=>this.error.set(errorMessage(e))});}
}

@Component({selector:'app-denied',standalone:false,template:`<section class="empty-state page-panel"><span class="empty-icon"><pg-icon name="shield" [size]="32" /></span><p class="eyebrow">PERMISOS DE LA CUENTA</p><h1>No tienes acceso a esta sección</h1><p>Vuelve a iniciar sesión o revisa los permisos de tu cuenta.<br>La administración requiere el rol Rabbit.Admin.</p><a class="button" routerLink="/">Volver al inicio <pg-icon name="arrow" /></a></section>`})
export class DeniedComponent {}
