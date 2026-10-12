import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { APP_CONFIG } from './app-config';

export interface Product { id: string; nombre: string; precio: number; stock: number; imagen?: string; }
export interface Catalog { catalogo: Product[]; categoriasDisponibles: unknown[]; resumen: { totalProductos: number; totalCategorias: number }; }
export interface Profile { usuarioId: number; nombre: string; apellido: string; email: string; }

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_CONFIG);
  catalog() { return this.http.get<Catalog>(this.config.bffUrl + '/api/bff/catalogo-completo'); }
  profile() { return this.http.post<Profile>(this.config.bffUrl + '/api/bff/profile', {}); }
  queue(name: string) { return this.http.get<Record<string, unknown>>(this.config.bffUrl + '/api/bff/admin/queues/' + encodeURIComponent(name)); }
}
