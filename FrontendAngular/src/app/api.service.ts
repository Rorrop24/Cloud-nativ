import { inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { APP_CONFIG } from './app-config';
export interface Product { id:string; nombre:string; precio:number; stock:number; imagen?:string; descuento?:number; categoria?:{id:number;nombre:string}|null; }
export interface Catalog { catalogo:Product[]; categoriasDisponibles:unknown[]; resumen:{totalProductos:number;totalCategorias:number}; }
export interface Profile { usuarioId:number;nombre:string;apellido:string;email:string; }
export interface CartItem extends Product { quantity:number;unitPrice:number; }
export interface Cart { items:CartItem[];total:number; }
export interface Receipt { id:number;total:number; }
export interface Document { event_id:string;title:string;boleta_id:number;created_at:string; }
export interface Topology { queues:{name:string;exists:boolean;messages:number;consumers:number}[];exchanges:string[]; }
export interface PublishedEvent {eventId:string;reference:string;routed:boolean;}
@Injectable({providedIn:'root'})
export class ApiService {
  readonly cartCount=signal<number|null>(null);
  private count=(cart:Cart)=>this.cartCount.set(cart.items.reduce((sum,item)=>sum+item.quantity,0));
  private readonly http=inject(HttpClient);private readonly config=inject(APP_CONFIG);
  private base(field:'cartUrl'|'adminUrl'|'notificationsUrl'|'inventoryUrl'){return this.config[field]??this.config.backendUrl;}
  catalog(){return this.http.get<Catalog>(this.config.bffUrl+'/api/bff/catalogo-completo');}
  profile(){return this.http.post<Profile>(this.config.bffUrl+'/api/bff/profile',{});}
  cart(){return this.http.get<Cart>(this.base('cartUrl')+'/api/cart').pipe(tap(this.count));}
  add(productId:string,quantity=1){return this.http.post<Cart>(this.base('cartUrl')+'/api/cart/items',{productId,quantity}).pipe(tap(this.count));}
  quantity(productId:string,quantity:number){return this.http.put<Cart>(this.base('cartUrl')+'/api/cart/items/'+encodeURIComponent(productId),{quantity}).pipe(tap(this.count));}
  remove(productId:string){return this.http.delete<Cart>(this.base('cartUrl')+'/api/cart/items/'+encodeURIComponent(productId)).pipe(tap(this.count));}
  checkout(){return this.http.post<Receipt>(this.base('cartUrl')+'/api/cart/checkout',{}).pipe(tap(()=>this.cartCount.set(0)));}
  documents(){return this.http.get<Document[]>(this.base('notificationsUrl')+'/api/notifications');}
  document(id:string){return this.http.get(this.base('notificationsUrl')+'/api/notifications/'+encodeURIComponent(id)+'/document',{responseType:'text'});}
  topology(){return this.http.get<Topology>(this.base('adminUrl')+'/api/rabbitmq/topology');}
  queue(name:string){return this.http.get<Record<string,unknown>>(this.base('adminUrl')+'/api/rabbitmq/queues/'+encodeURIComponent(name));}
  createQueue(queueName:string){return this.http.post(this.base('adminUrl')+'/api/rabbitmq/queues',{queueName,durable:true,queueType:'quorum'});}
  deleteQueue(queueName:string){return this.http.delete(this.base('adminUrl')+'/api/rabbitmq/queues/'+encodeURIComponent(queueName));}
  createExchange(exchangeName:string,type:string){return this.http.post(this.base('adminUrl')+'/api/rabbitmq/exchanges',{exchangeName,type,durable:true});}
  deleteExchange(name:string){return this.http.delete(this.base('adminUrl')+'/api/rabbitmq/exchanges/'+encodeURIComponent(name));}
  binding(queueName:string,exchangeName:string,routingKey:string,remove=false){return this.http.request(remove?'DELETE':'POST',this.base('adminUrl')+'/api/rabbitmq/bindings',{body:{queueName,exchangeName,routingKey}});}
  event(domain:string,reference:string,message:string){return this.http.post<PublishedEvent>(this.base('adminUrl')+'/api/rabbitmq/events',{domain,reference,message});}
  movements(){return this.http.get<Record<string,unknown>[]>(this.base('inventoryUrl')+'/api/inventory/movements');}
}
