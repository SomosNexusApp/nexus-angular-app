import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, inject, ChangeDetectorRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, Subscription, forkJoin, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil, catchError, map } from 'rxjs/operators';
import { HostListener } from '@angular/core';

import { SearchService, SearchParams, SearchResultItem } from '../../core/services/search.service';
import { ScrollService } from '../../core/services/scroll.service';
import { AuthStore } from '../../core/auth/auth-store';
import { ProductoCardComponent } from '../../shared/components/marketplace/product-card/producto-card.component';
import { OfertaCardComponent } from '../../shared/components/marketplace/oferta-card/oferta-card.component';
import { VehiculoCardComponent } from '../../shared/components/vehiculo-card/vehiculo-card.component';
import { MarketplaceItem } from '../../models/marketplace-item.model';

declare var L: any;
const PAGINAS_AUTO_LOAD = 3;

@Component({
  selector: 'app-vehiculos',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    ProductoCardComponent,
    OfertaCardComponent,
    VehiculoCardComponent,
  ],
  templateUrl: './vehiculos.component.html',
  styleUrls: ['./vehiculos.component.css'],
})
export class VehiculosComponent implements OnInit, AfterViewInit, OnDestroy {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private searchService = inject(SearchService);
  private authStore = inject(AuthStore);
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private scrollService = inject(ScrollService);

  filterForm!: FormGroup;
  resultados: MarketplaceItem[] = [];
  cargando = true;
  cargandoMas = false;
  totalResultados = 0;
  busquedaRealizada = false;

  paginaActual = 0;
  sizePorPagina = 20;
  hayMasResultados = true;
  @ViewChild('scrollAnchor') scrollAnchor!: ElementRef;
  private observer!: IntersectionObserver;

  isMobileFiltersOpen = false;
  obteniendoUbicacion = false;

  private destroy$ = new Subject<void>();
  private formSub!: Subscription;

  sugerenciasUbicacion: any[] = [];
  mostrandoSugerenciasUbi = false;
  mostrandoMapaModal = false;
  private map: any;
  private marker: any;
  private radiusCircle: any;

  marcasDisponibles: string[] = [];
  modelosDisponibles: string[] = [];

  condicionesDisponibles = [
    { value: '', label: 'Cualquier estado', icon: 'fas fa-tags' },
    { value: 'NUEVO_OFERTA', label: 'Nuevo / Oferta', icon: 'fas fa-fire' },
    { value: 'NUEVO', label: 'A estrenar (Nuevo)', icon: 'fas fa-star' },
    { value: 'COMO_NUEVO', label: 'Como nuevo', icon: 'fas fa-wand-magic-sparkles' },
    { value: 'MUY_BUEN_ESTADO', label: 'Muy buen estado', icon: 'fas fa-check-double' },
    { value: 'BUEN_ESTADO', label: 'Buen estado', icon: 'fas fa-check' },
    { value: 'ACEPTABLE', label: 'Aceptable', icon: 'fas fa-thumbs-up' }
  ];

  opcionesOrden = [
    { value: 'relevancia', label: 'Mejor coincidencia', icon: 'fas fa-sort-amount-down' },
    { value: 'novedades', label: 'Novedades primero', icon: 'fas fa-calendar-plus' },
    { value: 'precio_asc', label: 'Precio: bajo a alto', icon: 'fas fa-arrow-up-9-1' },
    { value: 'precio_desc', label: 'Precio: alto a bajo', icon: 'fas fa-arrow-down-9-1' }
  ];

  condicionNombreActual = signal<string>('Cualquier estado');
  condicionIconoActual = signal<string>('fas fa-tags');
  
  ordenNombreActual = signal<string>('Mejor coincidencia');
  ordenIconoActual = signal<string>('fas fa-sort-amount-down');
  
  mostrandoCondiciones = false;
  mostrandoOrden = false;

  ngOnInit(): void {
    this.initForm();
    this.cargarMarcas();
    this.escucharAutocompletados();
    this.realizarBusqueda(true);
  }

  ngAfterViewInit(): void {
    this.setupIntersectionObserver();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.scrollService.unlock();
    if (this.observer) this.observer.disconnect();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.nx-custom-select-container')) {
      this.mostrandoCondiciones = false;
      this.mostrandoOrden = false;
      this.cdr.detectChanges();
    }
  }

  private initForm(): void {
    this.filterForm = this.fb.group({
      q: [''],
      precioMin: [''],
      precioMax: [''],
      condicion: [''],
      ubicacion: [''],
      orden: ['relevancia'],
      marca: [''],
      modelo: [''],
      anioMin: [''],
      anioMax: [''],
      kmMax: [''],
      combustible: [''],
      cambio: [''],
      potenciaMin: [''],
      cilindradaMin: [''],
      color: [''],
      numeroPuertas: [''],
      plazas: [''],
      garantia: [false],
      itv: [false],
      radius: [50],
      lat: [null],
      lng: [null],
    });

    this.formSub = this.filterForm.valueChanges
      .pipe(
        debounceTime(400),
        distinctUntilChanged((p, c) => JSON.stringify(p) === JSON.stringify(c)),
        takeUntil(this.destroy$),
      )
      .subscribe((v) => {
        this.realizarBusqueda(true);
      });
  }

  private cargarMarcas(): void {
    this.searchService
      .getMarcasVehiculos()
      .pipe(takeUntil(this.destroy$))
      .subscribe((marcas: any[]) => {
        this.marcasDisponibles = marcas.map(m => typeof m === 'object' ? m.name : m);
        this.cdr.detectChanges();
      });
  }

  private cargarModelos(marca: string): void {
    if (!marca) {
      this.modelosDisponibles = [];
      this.cdr.detectChanges();
      return;
    }
    this.searchService
      .getModelosPorMarca(marca)
      .pipe(takeUntil(this.destroy$))
      .subscribe((modelos) => {
        this.modelosDisponibles = modelos;
        this.cdr.detectChanges();
      });
  }

  toggleMapa(): void {
    this.mostrandoMapaModal = !this.mostrandoMapaModal;
    if (this.mostrandoMapaModal) {
      this.scrollService.lock();
      setTimeout(() => this.initMapa(), 100);
    } else {
      this.scrollService.unlock();
    }
  }

  private initMapa(): void {
    if (typeof L === 'undefined') return;
    
    if (this.map) {
      try {
        this.map.remove();
        this.map = null;
        this.marker = null;
      } catch (e) {
        console.error(e);
      }
    }

    const initialLat = this.filterForm.get('lat')?.value || 40.4168;
    const initialLng = this.filterForm.get('lng')?.value || -3.7038;

    this.map = L.map('nx-search-map', { 
      attributionControl: false,
      zoomControl: false 
    }).setView([initialLat, initialLng], 13);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19
    }).addTo(this.map);

    this.marker = L.marker([initialLat, initialLng], { 
      draggable: true,
      icon: L.divIcon({
        className: 'nx-custom-marker',
        html: '<div class="nx-marker-dot"></div><div class="nx-marker-pulse"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      })
    }).addTo(this.map);

    this.marker.on('dragend', () => this.updateRadiusCircle());
    this.map.on('click', (e: any) => {
      this.marker.setLatLng(e.latlng);
      this.updateRadiusCircle();
    });

    this.updateRadiusCircle();
  }

  updateRadiusCircle(): void {
    if (!this.map || !this.marker) return;
    const pos = this.marker.getLatLng();
    const radiusKm = this.filterForm.get('radius')?.value || 5;

    if (this.radiusCircle) {
      this.radiusCircle.setLatLng(pos);
      this.radiusCircle.setRadius(radiusKm * 1000);
    } else {
      this.radiusCircle = L.circle(pos, {
        radius: radiusKm * 1000,
        color: '#6366f1',
        fillColor: '#6366f1',
        fillOpacity: 0.1,
        weight: 1
      }).addTo(this.map);
    }
    this.map.fitBounds(this.radiusCircle.getBounds(), { padding: [20, 20] });
  }

  confirmarUbicacionMapa(): void {
    if (!this.marker) return;
    const pos = this.marker.getLatLng();
    this.filterForm.patchValue({ lat: pos.lat, lng: pos.lng });
    this.reverseGeocode(pos.lat, pos.lng);
    this.mostrandoMapaModal = false;
    this.mostrandoSugerenciasUbi = false;
    this.scrollService.unlock();
  }

  private reverseGeocode(lat: number, lng: number): void {
    this.http
      .get<any>(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const ciudad =
            res?.address?.city || res?.address?.town || res?.address?.village || res?.address?.municipality || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
          this.filterForm.patchValue({ ubicacion: ciudad });
        },
        error: () => {
          this.filterForm.patchValue({ ubicacion: `${lat.toFixed(4)}, ${lng.toFixed(4)}` });
        },
      });
  }

  private realizarBusqueda(reiniciar = false): void {
    if (reiniciar) {
      this.cargando = true;
      this.paginaActual = 0;
      this.resultados = [];
      this.hayMasResultados = true;
    } else {
      this.cargandoMas = true;
    }

    const fv = this.filterForm.value;
    const usuarioId = this.authStore.user()?.id;

    let condicionFinal = fv.condicion;
    let tipoOfertaCondicion = undefined;
    if (condicionFinal === 'NUEVO_OFERTA') {
      tipoOfertaCondicion = 'NUEVO';
    }

    const vehiculosParams: SearchParams = {
      ...fv,
      tipo: 'VEHICULO',
      page: this.paginaActual,
      size: this.sizePorPagina,
      condicion: condicionFinal === 'NUEVO_OFERTA' ? 'NUEVO' : fv.condicion || undefined,
      orden: fv.orden || 'relevancia'
    };

    // Para las ofertas de vehiculos (chollos) no aplicamos los filtros super específicos de motor,
    // solo buscamos en la categoría de vehículos (slug o ID, en el general es string category)
    // El backend lo ignorará si no encaja.
    const ofertasParams: SearchParams = {
      tipo: 'OFERTA',
      categoria: 'vehiculos', // O el id correspondiente, usaremos el slug para simplificar
      q: fv.q,
      precioMin: fv.precioMin,
      precioMax: fv.precioMax,
      condicion: tipoOfertaCondicion || fv.condicion,
      ubicacion: fv.ubicacion,
      orden: fv.orden,
      page: this.paginaActual,
      size: Math.max(1, Math.floor(this.sizePorPagina / 3)), // Mostraremos menos ofertas para mezclarlas
      lat: fv.lat,
      lng: fv.lng,
      radius: fv.radius
    };

    // Lanzar ambas busquedas
    forkJoin({
      vehiculosRes: this.searchService.buscar(vehiculosParams, usuarioId),
      ofertasRes: this.searchService.buscar(ofertasParams, usuarioId)
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: ({ vehiculosRes, ofertasRes }) => {
        let mezclados: MarketplaceItem[] = [];
        
        // Estrategia de mezcla premium: 1 oferta por cada 4 vehiculos, si las hay.
        let vList = vehiculosRes.items;
        let oList = ofertasRes.items;
        
        while (vList.length > 0 || oList.length > 0) {
          if (vList.length > 0) {
            mezclados.push(...vList.splice(0, 3));
          }
          if (oList.length > 0) {
            mezclados.push(oList.shift()!);
          }
        }

        const totalItemsEncontrados = vehiculosRes.total + ofertasRes.total;
        this.totalResultados = totalItemsEncontrados;
        
        this.resultados = reiniciar ? mezclados : [...this.resultados, ...mezclados];
        
        // Simple logica: si me devolvió los solicitados, quiza haya mas
        this.hayMasResultados = (vehiculosRes.items.length === this.sizePorPagina || ofertasRes.items.length === ofertasParams.size);
        
        this.cargando = false;
        this.cargandoMas = false;
        this.busquedaRealizada = true;
        this.cdr.detectChanges();
      },
      error: () => {
        this.cargando = false;
        this.cargandoMas = false;
        this.cdr.detectChanges();
      }
    });
  }

  private setupIntersectionObserver(): void {
    this.observer = new IntersectionObserver(
      ([entry]) => {
        if (
          entry.isIntersecting && 
          !this.cargando && 
          !this.cargandoMas && 
          this.hayMasResultados &&
          this.paginaActual < PAGINAS_AUTO_LOAD
        ) {
          this.paginaActual++;
          this.realizarBusqueda(false);
        }
      },
      { rootMargin: '150px' },
    );
    if (this.scrollAnchor) this.observer.observe(this.scrollAnchor.nativeElement);
  }

  private escucharAutocompletados(): void {
    this.filterForm
      .get('ubicacion')
      ?.valueChanges.pipe(debounceTime(400), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((q) => {
        if (q && q.length > 2 && !this.obteniendoUbicacion) {
          this.searchService.buscarUbicacionExterna(q).subscribe((s) => {
            this.sugerenciasUbicacion = s;
            this.mostrandoSugerenciasUbi = s.length > 0;
            this.cdr.detectChanges();
          });
        } else {
          this.sugerenciasUbicacion = [];
          this.mostrandoSugerenciasUbi = false;
          this.cdr.detectChanges();
        }
      });

    this.filterForm
      .get('marca')
      ?.valueChanges.pipe(distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((m) => {
        this.filterForm.patchValue({ modelo: '' }, { emitEvent: false });
        if (m) this.cargarModelos(m);
        else this.modelosDisponibles = [];
      });
  }

  seleccionarUbicacion(u: string, coords?: {lat: number, lng: number}): void {
    if (!u) return;
    this.filterForm.patchValue({ ubicacion: u });
    this.mostrandoSugerenciasUbi = false;

    if (coords && this.map && this.marker) {
      this.filterForm.patchValue({ lat: coords.lat, lng: coords.lng }, { emitEvent: false });
      this.marker.setLatLng([coords.lat, coords.lng]);
      this.map.setView([coords.lat, coords.lng], 13);
      this.updateRadiusCircle();
    } else {
      this.searchService.getCoordenadas(u).subscribe((newCoords) => {
        if (newCoords && this.map && this.marker) {
          this.filterForm.patchValue({ lat: newCoords.lat, lng: newCoords.lng }, { emitEvent: false });
          this.marker.setLatLng([newCoords.lat, newCoords.lng]);
          this.map.setView([newCoords.lat, newCoords.lng], 13);
          this.updateRadiusCircle();
        }
      });
    }
  }

  actualizarPrecioMax(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.filterForm.patchValue({ precioMax: input.value ? Number(input.value) : null });
  }

  cargarMasResultados(): void {
    if (!this.cargando && !this.cargandoMas && this.hayMasResultados) {
      this.paginaActual++;
      this.realizarBusqueda(false);
    }
  }

  get mostrarBotonCargarMas(): boolean {
    return this.hayMasResultados && !this.cargandoMas && this.paginaActual >= PAGINAS_AUTO_LOAD;
  }

  toggleCondiciones(event: Event): void {
    event.stopPropagation();
    this.mostrandoCondiciones = !this.mostrandoCondiciones;
    this.mostrandoOrden = false;
  }

  seleccionarCondicion(val: string): void {
    this.filterForm.patchValue({ condicion: val });
    this.mostrandoCondiciones = false;
    const opt = this.condicionesDisponibles.find(c => c.value === val) || this.condicionesDisponibles[0];
    this.condicionNombreActual.set(opt.label);
    this.condicionIconoActual.set(opt.icon);
    this.cdr.detectChanges();
  }

  toggleOrden(event: Event): void {
    event.stopPropagation();
    this.mostrandoOrden = !this.mostrandoOrden;
    this.mostrandoCondiciones = false;
  }

  seleccionarOrden(val: string): void {
    this.filterForm.patchValue({ orden: val });
    this.mostrandoOrden = false;
    const opt = this.opcionesOrden.find(o => o.value === val) || this.opcionesOrden[0];
    this.ordenNombreActual.set(opt.label);
    this.ordenIconoActual.set(opt.icon);
    this.cdr.detectChanges();
  }

  limpiarFiltros(): void {
    const q = this.filterForm.get('q')?.value;
    this.filterForm.reset({ q, orden: 'relevancia' });
    this.condicionNombreActual.set('Cualquier estado');
    this.condicionIconoActual.set('fas fa-tags');
    this.ordenNombreActual.set('Mejor coincidencia');
    this.ordenIconoActual.set('fas fa-sort-amount-down');
  }

  toggleMobileFilters(): void {
    this.isMobileFiltersOpen = !this.isMobileFiltersOpen;
  }

  usarUbicacionActual(): void {
    if (!navigator.geolocation) return;
    
    Promise.resolve().then(() => {
      this.obteniendoUbicacion = true;
      this.cdr.detectChanges();
    });

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        this.filterForm.patchValue({ lat: latitude, lng: longitude }, { emitEvent: false });

        if (this.map && this.marker) {
          this.marker.setLatLng([latitude, longitude]);
          this.map.setView([latitude, longitude], 13);
          this.updateRadiusCircle();
        }

        this.reverseGeocode(latitude, longitude);
        this.obteniendoUbicacion = false;
        this.mostrandoSugerenciasUbi = false;
        this.cdr.detectChanges();
      },
      () => {
        this.obteniendoUbicacion = false;
        this.cdr.detectChanges();
      },
    );
  }
}
