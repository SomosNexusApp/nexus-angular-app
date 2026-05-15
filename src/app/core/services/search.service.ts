import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, forkJoin, of, shareReplay, switchMap, concat, map, catchError, take, tap } from 'rxjs';

import { Producto } from '../../models/producto.model';
import { Oferta } from '../../models/oferta.model';
import { Vehiculo } from '../../models/vehiculo.model';
import { environment } from '../../../environments/environment';

export interface SearchParams {
  q?: string;
  tipo?: 'TODOS' | 'PRODUCTO' | 'OFERTA' | 'VEHICULO';
  categoria?: number | string;
  precioMin?: number | string;
  precioMax?: number | string;
  condicion?: string;
  ubicacion?: string;
  conEnvio?: boolean;
  orden?: string;
  page?: number;
  size?: number;
  // Vehículos
  marca?: string;
  modelo?: string;
  anioMin?: number | string;
  anioMax?: number | string;
  kmMax?: number | string;
  combustible?: string;
  cambio?: string;
  tipoVehiculo?: string;
  potenciaMin?: number | string;
  cilindradaMin?: number | string;
  color?: string;
  numeroPuertas?: number | string;
  plazas?: number | string;
  garantia?: boolean;
  itv?: boolean;
  lat?: number | string;
  lng?: number | string;
  radius?: number | string;
}

/** Lo que devuelve buscar() al componente */
export interface SearchResult {
  items: SearchResultItem[];
  total: number;
}

export type SearchResultItem =
  | (Producto & { searchType: 'PRODUCTO' })
  | (Oferta & { searchType: 'OFERTA' })
  | (Vehiculo & { searchType: 'VEHICULO' });

@Injectable({ providedIn: 'root' })
export class SearchService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  public searchTerm = signal('');

  private marcasCache: any[] = [];
  private marcaIdMap: { [display: string]: string } = {};
  private modelosCache: { [key: string]: string[] } = {};
  private localDatabase$: Observable<any>;

  constructor() {
    // Cargar base de datos local de alto rendimiento (Elite Engine)
    this.localDatabase$ = this.http.get<any>('assets/data/car-database.json').pipe(
      tap(db => console.log('Nexus Data Engine (v4): Base de datos local cargada con éxito', db.brands?.length, 'marcas')),
      shareReplay(1),
      catchError(err => {
        console.error('Nexus Data Engine (v4): ERROR al cargar la base de datos local assets/data/car-database.json', err);
        return of({ brands: [] });
      })
    );
  }

  // ─── MÉTODO PÚBLICO PRINCIPAL ───────────────────────────────────────────────

  buscar(params: SearchParams, usuarioId?: number): Observable<SearchResult> {
    const tipo = params.tipo || 'TODOS';

    if (tipo === 'PRODUCTO') return this.buscarProductos(params, usuarioId);
    if (tipo === 'OFERTA') return this.buscarOfertas(params, usuarioId);
    if (tipo === 'VEHICULO') return this.buscarVehiculos(params, usuarioId);

    // TODOS → Usamos el nuevo endpoint unificado del backend para mayor rapidez
    let p = new HttpParams()
      .set('page', String(params.page ?? 0))
      .set('size', String(params.size ?? 20));

    if (params.q) p = p.set('q', params.q);
    if (tipo && tipo !== 'TODOS') p = p.set('tipo', tipo);
    if (params.categoria) p = p.set('categoria', String(params.categoria));
    if (this.hasValue(params.precioMin)) p = p.set('precioMin', String(params.precioMin));
    if (this.hasValue(params.precioMax)) p = p.set('precioMax', String(params.precioMax));
    if (params.ubicacion) p = p.set('ubicacion', params.ubicacion);
    if (params.lat) p = p.set('lat', String(params.lat));
    if (params.lng) p = p.set('lng', String(params.lng));
    if (params.radius) p = p.set('radius', String(params.radius));
    if (params.condicion) p = p.set('condicion', params.condicion);
    if (params.orden) p = p.set('orden', params.orden);
    if (usuarioId) p = p.set('usuarioId', String(usuarioId));

    return this.http.get<any>(`${this.apiUrl}/market/search`, { params: p }).pipe(
      map((res) => ({
        items: res.items,
        total: res.total,
      })),
      catchError(() => of({ items: [], total: 0 })),
    );
  }

  // ─── BÚSQUEDAS POR TIPO ─────────────────────────────────────────────────────

  private buscarProductos(params: SearchParams, usuarioId?: number): Observable<SearchResult> {
    let p = new HttpParams()
      .set('page', String(params.page ?? 0))
      .set('size', String(params.size ?? 20));

    if (params.q) p = p.set('busqueda', params.q);
    if (params.categoria) p = p.set('categoria', String(params.categoria));
    if (this.hasValue(params.precioMin)) p = p.set('precioMin', String(params.precioMin));
    if (this.hasValue(params.precioMax)) p = p.set('precioMax', String(params.precioMax));
    if (params.ubicacion) p = p.set('ubicacion', params.ubicacion);
    if (params.conEnvio) p = p.set('conEnvio', 'true');
    if (params.condicion) p = p.set('condicion', params.condicion);
    if (params.orden) p = p.set('orden', params.orden);
    if (params.lat) p = p.set('lat', String(params.lat));
    if (params.lng) p = p.set('lng', String(params.lng));
    if (params.radius) p = p.set('radius', String(params.radius));
    if (usuarioId) p = p.set('usuarioId', String(usuarioId));

    return this.http.get<any>(`${this.apiUrl}/producto/filtrar`, { params: p }).pipe(
      map((res) => {
        const lista: any[] = res?.contenido ?? (Array.isArray(res) ? res : []);
        return {
          items: lista.map((item: any) => ({ ...item, searchType: 'PRODUCTO' as const })),
          total: res?.totalElementos ?? lista.length,
        };
      }),
      catchError(() => of({ items: [], total: 0 })),
    );
  }

  private buscarOfertas(params: SearchParams, usuarioId?: number): Observable<SearchResult> {
    const { ordenarPor, direccion } = this.mapOrdenToOferta(params.orden);

    let p = new HttpParams()
      .set('page', String(params.page ?? 0))
      .set('size', String(params.size ?? 20))
      .set('soloActivas', 'true')
      .set('ordenarPor', ordenarPor)
      .set('direccion', direccion);

    if (params.q) p = p.set('busqueda', params.q);
    if (params.categoria) p = p.set('categoria', String(params.categoria));
    if (this.hasValue(params.precioMin)) p = p.set('precioMin', String(params.precioMin));
    if (this.hasValue(params.precioMax)) p = p.set('precioMax', String(params.precioMax));
    if (params.lat) p = p.set('lat', String(params.lat));
    if (params.lng) p = p.set('lng', String(params.lng));
    if (params.radius) p = p.set('radius', String(params.radius));
    if (usuarioId) p = p.set('usuarioId', String(usuarioId));

    return this.http.get<any>(`${this.apiUrl}/oferta/filtrar`, { params: p }).pipe(
      map((res) => {
        const lista: any[] = res?.ofertas ?? res?.contenido ?? (Array.isArray(res) ? res : []);
        return {
          items: lista.map((item: any) => ({ ...item, searchType: 'OFERTA' as const })),
          total: res?.totalElementos ?? lista.length,
        };
      }),
      catchError(() => of({ items: [], total: 0 })),
    );
  }

  private buscarVehiculos(params: SearchParams, usuarioId?: number): Observable<SearchResult> {
    let p = new HttpParams()
      .set('page', String(params.page ?? 0))
      .set('size', String(params.size ?? 20));

    if (params.q) p = p.set('busqueda', params.q);
    if (params.tipoVehiculo) p = p.set('tipo', params.tipoVehiculo);
    if (params.marca) p = p.set('marca', params.marca);
    if (params.modelo) p = p.set('modelo', params.modelo);
    if (params.combustible) p = p.set('combustible', params.combustible);
    if (params.cambio) p = p.set('cambio', params.cambio);
    if (params.color) p = p.set('color', params.color);
    if (this.hasValue(params.precioMin)) p = p.set('precioMin', String(params.precioMin));
    if (this.hasValue(params.precioMax)) p = p.set('precioMax', String(params.precioMax));
    if (this.hasValue(params.anioMin)) p = p.set('anioMin', String(params.anioMin));
    if (this.hasValue(params.anioMax)) p = p.set('anioMax', String(params.anioMax));
    if (this.hasValue(params.kmMax)) p = p.set('kmMax', String(params.kmMax));
    if (this.hasValue(params.potenciaMin)) p = p.set('potenciaMin', String(params.potenciaMin));
    if (this.hasValue(params.cilindradaMin))
      p = p.set('cilindradaMin', String(params.cilindradaMin));
    if (this.hasValue(params.numeroPuertas))
      p = p.set('numeroPuertas', String(params.numeroPuertas));
    if (this.hasValue(params.plazas)) p = p.set('plazas', String(params.plazas));
    if (params.garantia === true) p = p.set('garantia', 'true');
    if (params.itv === true) p = p.set('itv', 'true');
    if (params.categoria) p = p.set('categoria', String(params.categoria));
    if (params.lat) p = p.set('lat', String(params.lat));
    if (params.lng) p = p.set('lng', String(params.lng));
    if (params.radius) p = p.set('radius', String(params.radius));
    if (usuarioId) p = p.set('usuarioId', String(usuarioId));
    if (params.orden) p = p.set('orden', params.orden);

    return this.http.get<any>(`${this.apiUrl}/vehiculo/filtrar`, { params: p }).pipe(
      map((res) => {
        const lista: any[] = res?.contenido ?? (Array.isArray(res) ? res : []);
        return {
          items: lista.map((item: any) => ({ ...item, searchType: 'VEHICULO' as const })),
          total: res?.totalElementos ?? lista.length,
        };
      }),
      catchError(() => of({ items: [], total: 0 })),
    );
  }

  // ─── HELPERS ────────────────────────────────────────────────────────────────

  /** Valor no vacío y no nulo */
  private hasValue(v: any): boolean {
    return v !== null && v !== undefined && v !== '';
  }

  /** Mapea el orden del frontend a los parámetros que acepta OfertaController */
  private mapOrdenToOferta(orden?: string): { ordenarPor: string; direccion: string } {
    switch (orden) {
      case 'precio_asc':
        return { ordenarPor: 'precioOferta', direccion: 'asc' };
      case 'precio_desc':
        return { ordenarPor: 'precioOferta', direccion: 'desc' };
      case 'reciente':
        return { ordenarPor: 'fechaPublicacion', direccion: 'desc' };
      case 'spark':
        return { ordenarPor: 'sparkScore', direccion: 'desc' };
      default:
        return { ordenarPor: 'fechaPublicacion', direccion: 'desc' };
    }
  }

  private ordenarResultados(items: SearchResultItem[], orden?: string): SearchResultItem[] {
    switch (orden) {
      case 'precio_asc':
        return [...items].sort((a, b) => this.getPrecio(a) - this.getPrecio(b));
      case 'precio_desc':
        return [...items].sort((a, b) => this.getPrecio(b) - this.getPrecio(a));
      case 'reciente':
        return [...items].sort(
          (a, b) =>
            new Date((b as any).fechaPublicacion || 0).getTime() -
            new Date((a as any).fechaPublicacion || 0).getTime(),
        );
      default:
        return items;
    }
  }

  private getPrecio(item: SearchResultItem): number {
    if (item.searchType === 'OFERTA') {
      return (item as any).precioOferta ?? (item as any).precioOriginal ?? 0;
    }
    return (item as any).precio ?? 0;
  }

  // ─── APIs EXTERNAS ───────────────────────────────────────────────────────────

  getCoordenadas(query: string): Observable<{ lat: number; lng: number } | null> {
    if (!query) return of(null);
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&countrycodes=es&format=json&limit=1`;
    return this.http.get<any[]>(url).pipe(
      map((resultados) => {
        if (resultados && resultados.length > 0) {
          return {
            lat: parseFloat(resultados[0].lat),
            lng: parseFloat(resultados[0].lon),
          };
        }
        return null;
      }),
      catchError(() => of(null)),
    );
  }

  buscarUbicacionExterna(query: string): Observable<any[]> {
    if (!query || query.length < 3) return of([]);
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&countrycodes=es&format=json&addressdetails=1&limit=8`;
    return this.http.get<any[]>(url).pipe(
      map((resultados) => {
        const vistos = new Set<string>();
        return resultados
          .map((res) => {
            const addr = res.address || {};
            const ciudad = addr.city || addr.town || addr.village || addr.municipality || addr.suburb || '';
            const provincia = addr.county || addr.state_district || addr.state || '';

            // Nombre corto: "Arahal, Sevilla" o solo "Sevilla" si es la capital
            const cp = addr.postcode || '';
            let display: string;
            
            if (ciudad && provincia && ciudad.toLowerCase() !== provincia.toLowerCase()) {
              display = `${ciudad}, ${provincia}`;
            } else if (ciudad) {
              display = ciudad;
            } else {
              display = provincia || query; // Fallback al query original si no hay nada
            }

            if (cp && !display.includes(cp)) {
              display += ` (${cp})`;
            }

            return {
              display: display.trim(),
              lat: parseFloat(res.lat),
              lng: parseFloat(res.lon),
            };
          })
          .filter((s) => {
            if (!s.display || s.display.length < 2 || vistos.has(s.display.toLowerCase())) return false;
            vistos.add(s.display.toLowerCase());
            return true;
          });
      }),
      catchError(() => of([])),
    );
  }

  getProvinciaDesdeCoordenadas(lat: number, lng: number): Observable<string | null> {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&lat=${lat}&lon=${lng}`;
    return this.http.get<any>(url).pipe(
      map((res) => {
        const addr = res?.address || {};
        const ciudad = addr.city || addr.town || addr.village || addr.municipality || addr.suburb || '';
        // Priorizar county (Sevilla) sobre state (Andalucía)
        const provincia = addr.county || addr.state_district || addr.province || addr.state || '';
        
        if (ciudad && provincia && ciudad.toLowerCase() !== provincia.toLowerCase()) {
          return `${ciudad}, ${provincia}`;
        }
        return ciudad || provincia || null;
      }),
      catchError(() => of(null)),
    );
  }

  /** Obtiene ciudad, provincia y CP de forma estructurada y limpia */
  buscarUbicacionEstructurada(query: string): Observable<any[]> {
    if (!query || query.length < 2) return of([]);
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&countrycodes=es&format=json&addressdetails=1&limit=8`;
    return this.http.get<any[]>(url).pipe(
      map((resultados) => {
        const unicos = new Set();
        return resultados
          .map((res) => {
            const addr = res.address;
            const ciudad =
              addr.city || addr.town || addr.village || addr.municipality || addr.suburb || '';
            const provincia = addr.county || addr.province || addr.state || '';
            const cp = addr.postcode || '';

            const lat = parseFloat(res.lat);
            const lng = parseFloat(res.lon);
            const display = `${ciudad}${provincia ? ', ' + provincia : ''}`.trim();

            return { ciudad, provincia, cp, display, lat, lng };
          })
          .filter((l) => {
            // Solo ciudades válidas y evitar duplicados visuales
            if (!l.ciudad || l.ciudad.length < 2 || unicos.has(l.display.toLowerCase()))
              return false;
            unicos.add(l.display.toLowerCase());
            return true;
          });
      }),
      catchError(() => of([])),
    );
  }

  getMarcasVehiculos(): Observable<any[]> {
    if (this.marcasCache.length > 0) return of(this.marcasCache);
    
    return this.localDatabase$.pipe(
      switchMap(db => {
        if (db.brands && db.brands.length > 0) {
          const brands = db.brands.map((b: any) => ({
            name: b.name,
            country: b.pais_origen
          })).sort((a: any, b: any) => a.name.localeCompare(b.name));
          this.marcasCache = brands;
          return of(brands);
        }
        
        // Fallback a CarQuery si la local falla
        const url = 'http://www.carqueryapi.com/api/0.3/?cmd=getMakes&sold_in_us=0';
        return this.http.jsonp<{ Makes: any[] }>(url, 'callback').pipe(
          map(res => {
            const marcas = res.Makes.map(m => ({ name: m.make_display, country: 'Internacional' })).sort((a: any, b: any) => a.name.localeCompare(b.name));
            this.marcasCache = marcas;
            return marcas;
          }),
          catchError(() => of([{ name: 'Renault', country: 'Francia' }, { name: 'Audi', country: 'Alemania' }]))
        );
      })
    );
  }

  getModelosPorMarca(marca: string): Observable<string[]> {
    if (!marca) return of([]);
    const key = marca.toLowerCase();
    
    // Carga desde base de datos local (Instantánea)
    const localModels$ = this.localDatabase$.pipe(
      take(1),
      map(db => {
        const brand = db.brands.find((b: any) => b.name.toLowerCase() === key);
        const models = brand ? brand.models.sort() : [];
        console.log(`Nexus Data Engine (v4): Cargando modelos locales para ${marca}:`, models.length, 'modelos encontrados');
        return models;
      })
    );

    // Carga desde APIs externas (Asíncrona)
    const brandId = marca.toLowerCase().replace(/\s+/g, '-');
    const cqUrl = `http://www.carqueryapi.com/api/0.3/?cmd=getModels&make=${encodeURIComponent(brandId)}&sold_in_us=0`;
    // Carga desde APIs externas (Asíncrona) - Solo si parece una marca seria (>3 chars) para evitar 500s de la API
    const isSeriousSearch = marca.length >= 4 || this.marcasCache.some(m => m.name.toLowerCase() === marca.toLowerCase());
    const externalModels$ = (!isSeriousSearch) ? of([]) : this.http.jsonp<{ Models: any[] }>(cqUrl, 'callback').pipe(
      map(res => (res?.Models || []).map(m => m.model_name).sort()),
      catchError(() => {
        const odsUrl = `https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/all-vehicles-model/records?limit=100&refine=make%3A"${encodeURIComponent(marca.toUpperCase())}"`;
        return this.http.get<any>(odsUrl).pipe(
          map(odsRes => (odsRes?.results || []).map((r: any) => r.model).sort()),
          catchError(() => of([]))
        );
      })
    );

    // Híbrido: Emitir local al momento, luego mergear con externa
    return localModels$.pipe(
      switchMap(local => {
        // Primera emisión: solo local
        const initial$ = of(local);
        
        // Segunda emisión: unida y deduplicada
        const combined$ = externalModels$.pipe(
          map(ext => {
            const joined = [...new Set([...local, ...ext])];
            const sorted = joined.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
            this.modelosCache[key] = sorted;
            return sorted;
          })
        );

        return concat(initial$, combined$);
      })
    );
  }

  private capitalize(text: string): string {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  }
}
