declare var L: any;
import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  AfterViewInit,
  inject,
  ChangeDetectorRef,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject, Subscription, of } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  takeUntil,
  catchError,
  switchMap,
  map,
} from 'rxjs/operators';
import { HostListener } from '@angular/core';

import { SearchService, SearchParams, SearchResultItem } from '../../core/services/search.service';
import { ScrollService } from '../../core/services/scroll.service';
import { AuthStore } from '../../core/auth/auth-store';
import { ProductoCardComponent } from '../../shared/components/marketplace/product-card/producto-card.component';
import { OfertaCardComponent } from '../../shared/components/marketplace/oferta-card/oferta-card.component';
import { VehiculoCardComponent } from '../../shared/components/vehiculo-card/vehiculo-card.component';
import { Categoria } from '../../models/categoria.model';
import { environment } from '../../../environments/environment';

// AdSense — exponer al template
import { MarketplaceItem } from '../../models/marketplace-item.model';

const VEHICLE_SLUGS = [
  'vehiculo',
  'vehiculos',
  'motor',
  'coches',
  'coche',
  'motos',
  'moto',
  'furgoneta',
  'camion',
  'caravana',
  'autobus',
  'quad',
  'barco',
];
const PAGINAS_AUTO_LOAD = 3;

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    ProductoCardComponent,
    OfertaCardComponent,
    VehiculoCardComponent,
  ],
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.css'],
})
export class SearchComponent implements OnInit, AfterViewInit, OnDestroy {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private searchService = inject(SearchService);
  private authStore = inject(AuthStore);
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private scrollService = inject(ScrollService);

  filterForm!: FormGroup;
  ubicacionInputControl = new FormControl('');
  resultados: MarketplaceItem[] = [];
  cargando = true;
  cargandoMas = false;
  totalResultados = 0;
  busquedaRealizada = false;
  private searchSubject = new Subject<{
    params: SearchParams;
    reiniciar: boolean;
    usuarioId?: number;
  }>();

  paginaActual = 0;
  sizePorPagina = 20;
  hayMasResultados = true;
  isMobile = signal(window.innerWidth <= 768);
  @ViewChild('scrollAnchor') scrollAnchor!: ElementRef;
  @ViewChild('adsenseSlot') adsenseSlot!: ElementRef;
  private observer!: IntersectionObserver;

  // AdSense — leídos del environment para usarlos en el template
  readonly adsenseClient = environment.adsenseClient || '';
  readonly adsenseSlotSearch = (environment as any).adsenseSlotSearch || '';
  private adsensePushed = false;

  isMobileFiltersOpen = false;
  esBusquedaVehiculo = false;
  obteniendoUbicacion = false;
  categoriaNombreActual = signal<string>('');
  categoriaIconoActual = signal<string>('fas fa-layer-group');

  private destroy$ = new Subject<void>();
  private formSub!: Subscription;

  sugerenciasUbicacion: any[] = [];
  mostrandoSugerenciasUbi = false;
  mostrandoMapaModal = false;
  private map: any;
  private marker: any;
  private radiusCircle: any;
  mostrandoCategorias = false;
  marcasDisponibles: string[] = [];
  modelosDisponibles: string[] = [];
  categoriasDisponibles: Categoria[] = [];

  condicionesDisponibles = [
    { value: '', label: 'Cualquier estado', icon: 'fas fa-tags' },
    { value: 'NUEVO_OFERTA', label: 'Nuevo / Oferta', icon: 'fas fa-fire' },
    { value: 'NUEVO', label: 'A estrenar (Nuevo)', icon: 'fas fa-star' },
    { value: 'COMO_NUEVO', label: 'Como nuevo', icon: 'fas fa-wand-magic-sparkles' },
    { value: 'MUY_BUEN_ESTADO', label: 'Muy buen estado', icon: 'fas fa-check-double' },
    { value: 'BUEN_ESTADO', label: 'Buen estado', icon: 'fas fa-check' },
    { value: 'ACEPTABLE', label: 'Aceptable', icon: 'fas fa-thumbs-up' },
  ];

  diasDisponibles = [
    { value: '', label: 'Cualquier fecha', icon: 'fas fa-calendar' },
    { value: '1', label: 'Últimas 24 horas', icon: 'fas fa-clock' },
    { value: '7', label: 'Últimos 7 días', icon: 'fas fa-calendar-week' },
    { value: '30', label: 'Último mes', icon: 'fas fa-calendar-alt' },
  ];
  mostrandoDias = false;

  opcionesOrden = [
    { value: 'relevancia', label: 'Mejor coincidencia', icon: 'fas fa-sort-amount-down' },
    { value: 'novedades', label: 'Novedades primero', icon: 'fas fa-calendar-plus' },
    { value: 'precio_asc', label: 'Precio: bajo a alto', icon: 'fas fa-arrow-up-9-1' },
    { value: 'precio_desc', label: 'Precio: alto a bajo', icon: 'fas fa-arrow-down-9-1' },
  ];

  condicionNombreActual = signal<string>('Cualquier estado');
  condicionIconoActual = signal<string>('fas fa-tags');

  diasNombreActual = signal<string>('Cualquier fecha');
  diasIconoActual = signal<string>('fas fa-calendar');

  ordenNombreActual = signal<string>('Mejor coincidencia');
  ordenIconoActual = signal<string>('fas fa-sort-amount-down');

  mostrandoCondiciones = false;
  mostrandoOrden = false;

  ngOnInit(): void {
    this.initForm();
    this.cargarCategorias();
    this.cargarMarcas();

    // Sincronizar el input de texto con el valor del formulario (ej: al cargar desde URL)
    this.filterForm.get('ubicacion')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(val => {
        if (this.ubicacionInputControl.value !== val) {
          this.ubicacionInputControl.setValue(val, { emitEvent: false });
        }
      });

    // Nueva lógica optimizada con switchMap DEBE ir antes de escucharCambiosURL
    // para no perder el disparo inicial si se emite síncronamente.
    this.searchSubject
      .pipe(
        takeUntil(this.destroy$),
        switchMap(({ params, reiniciar, usuarioId }) => {
          return this.searchService.buscar(params, usuarioId).pipe(
            map((res) => ({ res, reiniciar })),
            catchError((err) => {
              console.error('Error en búsqueda:', err);
              return of({ res: { items: [], total: 0 }, reiniciar });
            }),
          );
        }),
      )
      .subscribe(({ res, reiniciar }) => {
        const { items, total } = res as any;
        this.totalResultados = total;
        this.resultados = reiniciar ? items : [...this.resultados, ...items];
        this.hayMasResultados = this.resultados.length < total;
        this.cargando = false;
        this.cargandoMas = false;
        this.busquedaRealizada = true;
        this.cdr.detectChanges();
      });

    this.escucharCambiosURL();
    this.escucharAutocompletados();

    window.addEventListener('resize', () => {
      this.isMobile.set(window.innerWidth <= 768);
    });
  }

  ngAfterViewInit(): void {
    this.setupIntersectionObserver();
    this.initAdsense();
  }

  /** Inicializa el slot de AdSense una sola vez y solo en producción. */
  private initAdsense(): void {
    if (this.adsensePushed) return;
    if (!this.adsenseClient || !this.adsenseSlotSearch) return;

    // En localhost no intentamos cargar AdSense (evita errores de consola)
    const isLocal =
      window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal) return;

    try {
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
      this.adsensePushed = true;
    } catch (_) {}
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
      this.mostrandoCategorias = false;
      this.mostrandoCondiciones = false;
      this.mostrandoOrden = false;
      this.mostrandoDias = false;
      this.cdr.detectChanges();
    }
  }

  private initForm(): void {
    this.filterForm = this.fb.group({
      q: [''],
      tipo: ['TODOS'],
      categoria: [''],
      diasPublicacion: [''],
      precioMin: [''],
      precioMax: [''],
      condicion: [''],
      ubicacion: [''],
      conEnvio: [false],
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
      radius: [150], // km por defecto solicitado por el usuario
      lat: [null],
      lng: [null],
    });

    this.filterForm
      .get('tipo')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((tipo) => {
        this.esBusquedaVehiculo = tipo === 'VEHICULO';
        if (!this.esBusquedaVehiculo) this.limpiarFiltrosMotor();
        this.cdr.detectChanges();
      });

    this.formSub = this.filterForm.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged((p, c) => JSON.stringify(p) === JSON.stringify(c)),
        takeUntil(this.destroy$),
      )
      .subscribe((v) => this.actualizarURL(v));
  }

  private cargarCategorias(): void {
    this.http
      .get<Categoria[]>(`${environment.apiUrl}/categorias`)
      .pipe(
        takeUntil(this.destroy$),
        catchError(() => []),
      )
      .subscribe((cats) => {
        // Filtrar 'zapatillas' para que no aparezca en el primer nivel (se busca dentro de moda)
        this.categoriasDisponibles = cats.filter(c => c.slug !== 'zapatillas' && c.nombre.toLowerCase() !== 'zapatillas');
        const slugActual = this.filterForm.get('categoria')?.value;
        if (slugActual) this.actualizarTituloCat(slugActual);
        this.cdr.detectChanges();
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

  private escucharCambiosURL(): void {
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      if (this.formSub) this.formSub.unsubscribe();
      const tipoParam = params['tipo'] || 'TODOS';
      const catParam = params['categoria'] || '';
      this.esBusquedaVehiculo = (tipoParam === 'VEHICULO' || this.slugEsVehiculo(catParam)) && catParam !== 'flash';
      this.actualizarTituloCat(catParam);

      this.filterForm.patchValue(
        {
          q: params['q'] || '',
          tipo: catParam === 'flash' ? 'OFERTA' : (this.esBusquedaVehiculo ? 'VEHICULO' : tipoParam),
          categoria: catParam,
          precioMin: params['precioMin'] || '',
          precioMax: params['precioMax'] || '',
          condicion: params['condicion'] || '',
          ubicacion: params['ubicacion'] || '',
          conEnvio: params['conEnvio'] === 'true',
          orden: params['orden'] || 'relevancia',
          marca: params['marca'] || '',
          modelo: params['modelo'] || '',
          anioMin: params['anioMin'] || '',
          anioMax: params['anioMax'] || '',
          kmMax: params['kmMax'] || '',
          combustible: params['combustible'] || '',
          cambio: params['cambio'] || '',
          potenciaMin: params['potenciaMin'] || '',
          cilindradaMin: params['cilindradaMin'] || '',
          color: params['color'] || '',
          numeroPuertas: params['numeroPuertas'] || '',
          plazas: params['plazas'] || '',
          garantia: params['garantia'] === 'true',
          itv: params['itv'] === 'true',
        },
        { emitEvent: false },
      );

      this.actualizarTituloCondicion(params['condicion'] || '');
      this.actualizarTituloOrden(params['orden'] || 'relevancia');

      if (params['marca']) this.cargarModelos(params['marca']);
      this.formSub = this.filterForm.valueChanges
        .pipe(debounceTime(300), takeUntil(this.destroy$))
        .subscribe((v) => this.actualizarURL(v));
      this.realizarBusqueda(true);
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

  limpiarUbicacion(): void {
    this.filterForm.patchValue({
      ubicacion: '',
      lat: null,
      lng: null,
    });
    if (this.marker) {
      this.marker.remove();
      this.marker = null;
    }
    if (this.radiusCircle) {
      this.radiusCircle.remove();
      this.radiusCircle = null;
    }
    // No cerramos el modal si está abierto, pero si estamos en el modo normal,
    // la URL se actualizará por el valueChanges
  }

  private initMapa(): void {
    if (typeof L === 'undefined') return;

    // Si ya existe una instancia, la removemos para evitar conflictos con el DOM recreado por @if
    if (this.map) {
      try {
        this.map.remove();
        this.map = null;
        this.marker = null;
        this.radiusCircle = null;
      } catch (e) {
        console.error('Error al limpiar el mapa:', e);
      }
    }

    const initialLat = this.filterForm.get('lat')?.value || 40.4168; // Madrid (solo fallback)
    const initialLng = this.filterForm.get('lng')?.value || -3.7038;

    this.map = L.map('nx-search-map', {
      attributionControl: false,
      zoomControl: false, // Opcional para un look más limpio
    }).setView([initialLat, initialLng], 13);

    // Tile layer Premium Black (CartoDB Dark Matter)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(this.map);

    this.marker = L.marker([initialLat, initialLng], {
      draggable: true,
      icon: L.divIcon({
        className: 'nx-custom-marker',
        html: '<div class="nx-marker-dot"></div><div class="nx-marker-pulse"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      }),
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
        weight: 1,
      }).addTo(this.map);
    }

    // Centrar y ajustar zoom para ver todo el radio con un margen generoso
    this.map.fitBounds(this.radiusCircle.getBounds(), { padding: [20, 20] });
  }

  confirmarUbicacionMapa(): void {
    if (!this.marker) return;
    const pos = this.marker.getLatLng();
    this.filterForm.patchValue({
      lat: pos.lat,
      lng: pos.lng,
    });
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
            res?.address?.city ||
            res?.address?.town ||
            res?.address?.village ||
            res?.address?.municipality ||
            `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
          this.filterForm.patchValue({ ubicacion: ciudad });
        },
        error: () => {
          this.filterForm.patchValue({ ubicacion: `${lat.toFixed(4)}, ${lng.toFixed(4)}` });
        },
      });
  }

  private actualizarURL(valores: any): void {
    const queryParams: any = {};
    Object.keys(valores).forEach((k) => {
      if (valores[k] !== '' && valores[k] !== false && valores[k] !== null)
        queryParams[k] = valores[k];
    });
    this.router.navigate([], { relativeTo: this.route, queryParams, replaceUrl: false });
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

    // CASO ESPECIAL: Nuevo / Oferta
    let tipoFinal = fv.tipo;
    let condicionFinal = fv.condicion;
    if (condicionFinal === 'NUEVO_OFERTA') {
      tipoFinal = 'OFERTA';
      condicionFinal = 'NUEVO';
    }

    const params: SearchParams = {
      ...fv,
      tipo: tipoFinal,
      page: this.paginaActual,
      size: this.sizePorPagina,
      categoria: fv.categoria || undefined,
      precioMin: fv.precioMin || undefined,
      precioMax: fv.precioMax || undefined,
      condicion: condicionFinal || undefined,
      ubicacion: fv.ubicacion || undefined,
      conEnvio: fv.conEnvio || undefined,
    };

    const usuarioId = this.authStore.user()?.id;

    // Emitir a través del subject para que switchMap cancele peticiones solapadas
    this.searchSubject.next({ params, reiniciar, usuarioId });
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
    this.ubicacionInputControl.valueChanges
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((q: string | null) => {
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

    this.filterForm
      .get('categoria')
      ?.valueChanges.pipe(distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((slug) => {
        this.actualizarTituloCat(slug || '');
        if (slug === 'flash') {
          this.filterForm.patchValue({ tipo: 'OFERTA' }, { emitEvent: false });
          this.esBusquedaVehiculo = false;
        } else if (this.slugEsVehiculo(slug)) {
          this.filterForm.patchValue({ tipo: 'VEHICULO' }, { emitEvent: false });
          this.esBusquedaVehiculo = true;
        } else if (this.filterForm.get('tipo')?.value === 'VEHICULO') {
          this.filterForm.patchValue({ tipo: 'TODOS' }, { emitEvent: false });
          this.esBusquedaVehiculo = false;
        }
      });
  }

  seleccionarUbicacion(u: string, coords?: { lat: number; lng: number }): void {
    if (!u) return;
    
    // Actualizamos el control de texto (standalone) sin disparar su valueChanges
    this.ubicacionInputControl.setValue(u, { emitEvent: false });
    this.mostrandoSugerenciasUbi = false;

    // Actualizamos el formulario de una sola vez para disparar una sola búsqueda
    const updateData: any = { ubicacion: u };
    if (coords) {
      updateData.lat = coords.lat;
      updateData.lng = coords.lng;
    }

    this.filterForm.patchValue(updateData, { emitEvent: true });

    // Actualizar elementos visuales del mapa
    if (coords && this.map && this.marker) {
      this.marker.setLatLng([coords.lat, coords.lng]);
      this.map.setView([coords.lat, coords.lng], 13);
      this.updateRadiusCircle();
    } else if (!coords) {
      // Geocodificar si no tenemos coordenadas
      this.searchService.getCoordenadas(u).subscribe((newCoords) => {
        if (newCoords && this.map && this.marker) {
          this.filterForm.patchValue(
            {
              lat: newCoords.lat,
              lng: newCoords.lng,
            },
            { emitEvent: true },
          );

          this.marker.setLatLng([newCoords.lat, newCoords.lng]);
          this.map.setView([newCoords.lat, newCoords.lng], 13);
          this.updateRadiusCircle();
        }
      });
    }
    this.cdr.detectChanges();
  }

  usarUbicacionActual(): void {
    if (!navigator.geolocation) return;

    // Usar microtarea para evitar ExpressionChangedAfterItHasBeenCheckedError si el spinner se activa síncronamente
    Promise.resolve().then(() => {
      this.obteniendoUbicacion = true;
      this.cdr.detectChanges();
    });

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        this.searchService.getProvinciaDesdeCoordenadas(lat, lng).subscribe((lugar) => {
          this.seleccionarUbicacion(lugar || 'Ubicación actual', { lat, lng });
          this.obteniendoUbicacion = false;
          this.cdr.detectChanges();
        });
      },
      () => {
        this.obteniendoUbicacion = false;
        this.cdr.detectChanges();
      },
      { timeout: 5000 },
    );
  }

  private slugEsVehiculo(s: string): boolean {
    return s ? VEHICLE_SLUGS.some((kw) => s.toLowerCase().includes(kw)) : false;
  }

  private actualizarTituloCat(slug: string): void {
    if (!slug) {
      this.categoriaNombreActual.set('');
      this.categoriaIconoActual.set('fas fa-layer-group');
      return;
    }

    if (slug === 'flash') {
      this.categoriaNombreActual.set('Ofertas Flash');
      this.categoriaIconoActual.set('fas fa-bolt-lightning');
      return;
    }

    const cat = this.categoriasDisponibles.find((c) => c.slug === slug);
    this.categoriaNombreActual.set(cat ? cat.nombre : slug.charAt(0).toUpperCase() + slug.slice(1));
    this.categoriaIconoActual.set(this.getIconoCategoria(cat || null));
  }

  toggleCategorias(event: Event): void {
    event.stopPropagation();
    this.mostrandoCategorias = !this.mostrandoCategorias;
    this.mostrandoCondiciones = false;
    this.mostrandoOrden = false;
    this.mostrandoDias = false;
  }

  seleccionarCategoria(cat: Categoria | null): void {
    const slug = cat ? cat.slug : '';
    this.filterForm.patchValue({ categoria: slug });
    this.mostrandoCategorias = false;
    this.actualizarTituloCat(slug);
    this.cdr.detectChanges();
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
    this.mostrandoCategorias = false;
    this.mostrandoOrden = false;
    this.mostrandoDias = false;
  }

  seleccionarCondicion(val: string): void {
    this.filterForm.patchValue({ condicion: val });
    this.mostrandoCondiciones = false;
    this.actualizarTituloCondicion(val);
    this.cdr.detectChanges();
  }

  private actualizarTituloCondicion(val: string): void {
    const opt =
      this.condicionesDisponibles.find((c) => c.value === val) || this.condicionesDisponibles[0];
    this.condicionNombreActual.set(opt.label);
    this.condicionIconoActual.set(opt.icon);
  }

  toggleDias(event: Event): void {
    event.stopPropagation();
    this.mostrandoDias = !this.mostrandoDias;
    this.mostrandoCategorias = false;
    this.mostrandoCondiciones = false;
    this.mostrandoOrden = false;
  }

  seleccionarDias(val: string): void {
    this.filterForm.patchValue({ diasPublicacion: val });
    this.mostrandoDias = false;
    this.actualizarTituloDias(val);
    this.cdr.detectChanges();
  }

  private actualizarTituloDias(val: string): void {
    const opt = this.diasDisponibles.find((c) => c.value === val) || this.diasDisponibles[0];
    this.diasNombreActual.set(opt.label);
    this.diasIconoActual.set(opt.icon);
  }

  toggleOrden(event: Event): void {
    event.stopPropagation();
    this.mostrandoOrden = !this.mostrandoOrden;
    this.mostrandoCategorias = false;
    this.mostrandoCondiciones = false;
    this.mostrandoDias = false;
  }

  seleccionarOrden(val: string): void {
    this.filterForm.patchValue({ orden: val });
    this.mostrandoOrden = false;
    this.actualizarTituloOrden(val);
    this.cdr.detectChanges();
  }

  private actualizarTituloOrden(val: string): void {
    const opt = this.opcionesOrden.find((o) => o.value === val) || this.opcionesOrden[0];
    this.ordenNombreActual.set(opt.label);
    this.ordenIconoActual.set(opt.icon);
  }

  limpiarFiltros(): void {
    const q = this.filterForm.get('q')?.value;
    this.filterForm.reset({ q, tipo: 'TODOS', orden: 'relevancia' });
    this.esBusquedaVehiculo = false;
    this.categoriaNombreActual.set('');
    this.actualizarTituloCondicion('');
    this.actualizarTituloOrden('relevancia');
  }

  private limpiarFiltrosMotor(): void {
    this.filterForm.patchValue(
      {
        marca: '',
        modelo: '',
        anioMin: '',
        anioMax: '',
        kmMax: '',
        combustible: '',
        cambio: '',
        garantia: false,
        itv: false,
      },
      { emitEvent: false },
    );
  }

  toggleMobileFilters(): void {
    this.isMobileFiltersOpen = !this.isMobileFiltersOpen;
  }


  getIconoCategoria(cat: Categoria | null): string {
    if (!cat) return 'fas fa-layer-group';

    // Mapa de iconos por slug para asegurar que siempre haya uno "de verdad"
    const iconMap: { [key: string]: string } = {
      juguetes: 'fas fa-puzzle-piece',
      motos: 'fas fa-motorcycle',
      moto: 'fas fa-motorcycle',
      moviles: 'fas fa-mobile-screen-button',
      telefonia: 'fas fa-mobile-screen-button',
      informatica: 'fas fa-laptop',
      electronica: 'fas fa-microchip',
      coches: 'fas fa-car',
      coche: 'fas fa-car',
      hogar: 'fas fa-house-user',
      muebles: 'fas fa-couch',
      inmuebles: 'fas fa-building',
      deportes: 'fas fa-basketball',
      libros: 'fas fa-book',
      camaras: 'fas fa-camera',
      audio: 'fas fa-headphones',
      consolas: 'fas fa-gamepad',
      electrodomesticos: 'fas fa-blender',
      zapatillas: 'fas fa-shoe-prints',
      zapatos: 'fas fa-shoe-prints',
      calzado: 'fas fa-shoe-prints',
      moda: 'fas fa-shirt',
      ropa: 'fas fa-shirt',
      vuelos: 'fas fa-plane',
      viajes: 'fas fa-plane-departure',
      vehiculos: 'fas fa-car',
      videojuegos: 'fas fa-gamepad',
      otros: 'fas fa-box-archive',
      flash: 'fas fa-bolt-lightning',
    };

    const slug = cat.slug?.toLowerCase();
    if (slug && iconMap[slug]) return iconMap[slug];

    let ico = cat.icono || 'fas fa-tag';
    // Normalizar icono si viene incompleto
    if (ico && !ico.includes('fa-')) ico = 'fa-' + ico;
    if (ico && !ico.includes('fas') && !ico.includes('fab') && !ico.includes('far'))
      ico = 'fas ' + ico;

    return ico;
  }
}
