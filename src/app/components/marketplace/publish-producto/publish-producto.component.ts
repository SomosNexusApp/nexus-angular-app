import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
  ViewChild,
  ElementRef,
  HostListener,
  AfterViewInit,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { debounceTime, distinctUntilChanged, switchMap, of, startWith } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';

import { environment } from '../../../../environments/environment';
import { GuestPopupService } from '../../../core/services/guest-popup.service';
import { AuthService } from '../../../core/auth/auth.service';
import { AuthStore } from '../../../core/auth/auth-store';
import { SearchService } from '../../../core/services/search.service';
import { ToastService } from '../../../core/services/toast.service';
import { Categoria } from '../../../models/categoria.model';

import { CondicionProducto } from '../../../models/producto.model';
import { ProductoCardComponent } from '../../../shared/components/marketplace/product-card/producto-card.component';
import { UiService } from '../../../core/services/ui.service';

export type PublishStep = 0 | 1 | 2 | 3 | 4;

@Component({
  selector: 'app-publish-producto',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, ProductoCardComponent],
  templateUrl: './publish-producto.component.html',
  styleUrls: ['./publish-producto.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublishProductoComponent implements OnInit, AfterViewInit {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private router = inject(Router);
  private authStore = inject(AuthStore);
  private authService = inject(AuthService);
  private guestPopupService = inject(GuestPopupService);
  private searchService = inject(SearchService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  private uiService = inject(UiService);

  // ── ESTADO ────────────────────────────────────────────────────────
  currentStep = signal<PublishStep>(0);
  categorias = signal<Categoria[]>([]);
  selectedCategory = signal<Categoria | null>(null);
  isInmuebles = computed(() => this.selectedCategory()?.slug === 'inmuebles');

  verificandoLink = signal(false);
  linkVerificado = signal(false);
  favicon = signal<string | null>(null);

  @ViewChild('descInput') descInput!: ElementRef<HTMLTextAreaElement>;

  isEditMode = signal(false);
  productId = signal<number | null>(null);

  images = signal<{ url: string; file?: File; isPrincipal: boolean; isExisting?: boolean }[]>([]);
  uploading = signal(false);

  // Formularios con tipado explícito para evitar inferencia restrictiva de 'null'
  step1Form = this.fb.group({
    categoriaId: this.fb.control<number | null>(null, Validators.required),
    condicion: this.fb.control<string | null>(null, Validators.required),
  });
  step2Form = this.fb.group({
    titulo: this.fb.control<string>('', {
      validators: [Validators.required, Validators.maxLength(80)],
      nonNullable: true,
    }),
    descripcion: this.fb.control<string>('', {
      validators: [Validators.required, Validators.maxLength(1000)],
      nonNullable: true,
    }),
    marca: this.fb.control<string>(''),
    modelo: this.fb.control<string>(''),
  });
  step3Form = this.fb.group({
    precio: this.fb.control<string>('', [Validators.required, Validators.pattern(/^[0-9]+([.,][0-9]{0,2})?$/)]),
    precioNegociable: this.fb.control<boolean>(false, { nonNullable: true }),
    tipoOferta: this.fb.control<string>('VENTA', {
      validators: [Validators.required],
      nonNullable: true,
    }),
    envio: this.fb.control<string>('NO', {
      validators: [Validators.required],
      nonNullable: true,
    }),
    precioEnvio: this.fb.control<number>(0, { nonNullable: true }),
    peso: this.fb.control<number>(2, { nonNullable: true }),
    weight_range: this.fb.control<string>('0-2', { nonNullable: true }),
    ubicacion: this.fb.control<string>('', {
      validators: [Validators.required],
      nonNullable: true,
    }),
    latitude: this.fb.control<number | null>(null),
    longitude: this.fb.control<number | null>(null),
  });

  // Signals para reactividad de los formularios
  step1Value = toSignal(this.step1Form.valueChanges.pipe(startWith(this.step1Form.value)));
  step2Value = toSignal(this.step2Form.valueChanges.pipe(startWith(this.step2Form.value)));
  step3Value = toSignal(this.step3Form.valueChanges.pipe(startWith(this.step3Form.value)));

  // Autocompletado Ubicación
  sugerenciasUbi = signal<any[]>([]);
  buscandoUbi = signal(false);
  locationConfirmed = signal(false);

  // Mapa de iconos para las categorías (Sincronizado con el backend)
  private iconPaths: Record<string, string> = {
    cpu: 'M4 4h16v16H4V4zm0 5h16M4 15h16M9 4v16M15 4v16',
    shirt: 'M6.5 2h11l1 4-5 3v11H9.5V9l-5-3z',
    home: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
    car: 'M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12.4V16c0 .6.4 1 1 1h2',
    laptop:
      'M2 16h20M2 16v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2M2 16V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10',
    gamepad:
      'M6 12h4M12 12h.01M15 10v4M18 12h.01M3 7h18a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z',
    bicycle: 'M12 12a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 0l-3-9h6l-3 9z',
    book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20M4 19.5V4.5A2.5 2.5 0 0 1 6.5 2H20v15H6.5a2.5 2.5 0 0 0-2.5 2.5z',
    archive:
      'M21 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3m18 0v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8m18 0-9 6-9-6',
    building: 'M3 21h18M3 7v14M21 21V7M9 21V3h6v18',
  };

  getIconoCategoria(cat: Categoria | null): string {
    if (!cat) return 'fas fa-layer-group';
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
    if (ico && !ico.includes('fa-')) ico = 'fa-' + ico;
    if (ico && !ico.includes('fas') && !ico.includes('fab') && !ico.includes('far')) ico = 'fas ' + ico;
    return ico;
  }

  getCategoryDesc(name: string): string {
    const descs: Record<string, string> = {
      'Electrónica': 'Móviles, informática y gadgets',
      'Moda y Accesorios': 'Ropa, calzado y complementos',
      'Hogar y Jardín': 'Muebles, decoración y bricolaje',
      'Coches y Motos': 'Vehículos y repuestos',
      'Deporte y Ocio': 'Material deportivo y fitness',
      'Videojuegos': 'Consolas, juegos y accesorios',
      'Libros y Música': 'Cultura y entretenimiento',
      'Coleccionismo': 'Antigüedades y objetos únicos',
      'Inmobiliaria': 'Venta y alquiler de inmuebles'
    };
    return descs[name] || 'Explora esta categoría';
  }

  previewProduct = computed(() => {
    const s1 = this.step1Value();
    const s2 = this.step2Value();
    const s3 = this.step3Value();
    const imgs = this.images();

    return {
      titulo: s2?.titulo || 'Título del anuncio',
      precio: this.parsePrice(s3?.precio),
      imagenPrincipal:
        imgs.length > 0
          ? imgs[0].url
          : 'https://placehold.co/600x400/0f1115/ffffff?text=Nexus+Product',
      ubicacion: s3?.ubicacion || 'Ubicación',
      condicion: s1?.condicion,
      fechaPublicacion: new Date().toISOString(),
      tipoOferta: s3?.tipoOferta || 'VENTA',
      searchType: 'PRODUCTO' as const,
    };
  });

  CONDICIONES: { val: CondicionProducto; label: string; desc: string }[] = [
    { val: 'NUEVO', label: 'Nuevo', desc: 'Precintado o con etiquetas.' },
    { val: 'COMO_NUEVO', label: 'Como nuevo', desc: 'Sin marcas de uso.' },
    { val: 'MUY_BUEN_ESTADO', label: 'Muy buen estado', desc: 'Poco uso, marcas mínimas.' },
    { val: 'BUEN_ESTADO', label: 'Buen estado', desc: 'Uso normal, funciona bien.' },
    { val: 'ACEPTABLE', label: 'Aceptable', desc: 'Se nota el uso, marcas visibles.' },
  ];

  writingTemplates = [
    { id: 'tech', name: 'Técnico', icon: 'cpu', content: '### Especificaciones Técnicas\n- Marca: \n- Modelo: \n- Estado: \n\n### Descripción\n' },
    { id: 'casual', name: 'Casual', icon: 'zap', content: '¡Hola! Vendo este producto porque... Está en muy buen estado y funciona perfecto.' },
    { id: 'minimal', name: 'Minimal', icon: 'align-left', content: 'Producto original. Poco uso. Entrega en mano o envío.' },
  ];

  getTemplateIcon(id: string): string {
    const map: Record<string, string> = { tech: 'cpu', casual: 'zap', minimal: 'align-left' };
    return map[id] || 'edit-3';
  }

  descriptionWordCount = computed(() => {
    const desc = this.step2Value()?.descripcion || '';
    return desc.trim() ? desc.trim().split(/\s+/).length : 0;
  });

  descriptionCharCount = computed(() => {
    return (this.step2Value()?.descripcion || '').length;
  });

  applyTemplate(content: string): void {
    const current = this.step2Form.get('descripcion')?.value || '';
    this.step2Form.patchValue({ descripcion: current + (current ? '\n\n' : '') + content });
  }

  parsePrice(val: any): number {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    const str = String(val).replace(',', '.');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  }

  onPriceInput(event: any): void {
    const input = event.target;
    let value = input.value;

    // Reemplazar coma por punto para validación interna si se prefiere, 
    // pero mantendremos lo que el usuario escribe y validaremos con regex.
    // Solo permitimos un separador decimal.
    const parts = value.split(/[.,]/);
    if (parts.length > 2) {
      value = parts[0] + '.' + parts.slice(1).join('');
    }

    // Limitar a 2 decimales
    if (parts.length === 2 && parts[1].length > 2) {
      value = parts[0] + (value.includes(',') ? ',' : '.') + parts[1].substring(0, 2);
    }

    input.value = value;
    this.step3Form.get('precio')?.setValue(value, { emitEvent: false });
  }

  // Helper para el editor Word-style
  execEditorCommand(command: string, value: string = ''): void {
    document.execCommand(command, false, value);
    this.syncDescription();
  }

  syncDescription(): void {
    const editor = document.querySelector('.pixel-editor-rich') as HTMLElement;
    if (editor) {
      this.step2Form.get('descripcion')?.setValue(editor.innerHTML, { emitEvent: true });
    }
  }

  onEditorBlur(): void {
    this.syncDescription();
  }

  constructor() {
    effect(() => {
      this.currentStep();
      this.initIcons(50);
      this.initIcons(200);
    });

    effect(() => {
      if (this.isInmuebles()) {
        this.step3Form.patchValue({ envio: 'NO' });
      }
    });
  }

  ngAfterViewInit(): void {
    this.initIcons(100);
    this.initIcons(1000);
  }

  private initIcons(delay: number): void {
    setTimeout(() => {
      // @ts-ignore
      const lucide = window.lucide;
      if (lucide && lucide.createIcons) {
        lucide.createIcons();
      }
    }, delay);
  }

  // ── UBICACIÓN REFINADA ─────────────────────────────────────────
  private searchTimeout: any;

  buscarUbi(event: any): void {
    const query = event.target.value;
    if (query.length < 3) {
      this.sugerenciasUbi.set([]);
      return;
    }

    if (this.searchTimeout) clearTimeout(this.searchTimeout);

    this.searchTimeout = setTimeout(() => {
      this.buscandoUbi.set(true);
      this.http
        .get<any[]>(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&addressdetails=1&limit=5`)
        .subscribe({
          next: (res) => {
            this.sugerenciasUbi.set(res);
            this.buscandoUbi.set(false);
          },
          error: () => this.buscandoUbi.set(false),
        });
    }, 500);
  }

  selectUbi(sug: any): void {
    this.step3Form.patchValue({
      ubicacion: sug.display_name,
      latitude: parseFloat(sug.lat),
      longitude: parseFloat(sug.lon),
    });
    this.sugerenciasUbi.set([]);
    this.locationConfirmed.set(true);
  }

  selectWeight(range: string, val: number): void {
    this.step3Form.patchValue({
      weight_range: range,
      peso: val
    });
  }

  ngOnInit(): void {
    if (!this.authStore.isLoggedIn()) {
      this.guestPopupService.showPopup('Para publicar');
      this.router.navigate(['/']);
      return;
    }
    this.cargarCategorias();

    // Check for mobile direct-publish (skip type selection step 0)
    this.route.queryParams.subscribe((qp) => {
      if (qp['fromMobile'] === '1' && !this.isEditMode()) {
        this.currentStep.set(1);
      }
    });

    // Check for edit mode
    this.route.params.subscribe((params) => {
      if (params['id']) {
        this.isEditMode.set(true);
        this.productId.set(+params['id']);
        this.cargarProducto(+params['id']);
      }
    });

    this.step3Form.get('esRegalo')?.valueChanges.subscribe((isRegalo) => {
      const priceControl = this.step3Form.get('precio');
      if (isRegalo) {
        priceControl?.setValue('0');
        priceControl?.disable();
      } else {
        priceControl?.enable();
      }
    });
    // Ya no saltamos el paso 0 en móvil, ahora lo optimizamos para que quepa sin scroll

  }

  private cargarProducto(id: number): void {
    this.http.get<any>(`${environment.apiUrl}/producto/${id}`).subscribe({
      next: (p) => {
        // Step 1
        this.step1Form.patchValue({
          categoriaId: p.categoria?.id,
          condicion: p.condicion,
        });
        if (p.categoria) {
          this.selectedCategory.set(p.categoria);
        }

        // Step 2
        this.step2Form.patchValue({
          titulo: p.titulo,
          descripcion: p.descripcion,
          marca: p.marca,
          modelo: p.modelo,
        });

        // Step 3
        const envioVal = p.admiteEnvio ? 'SI' : 'NO';
        this.step3Form.patchValue({
          precio: p.precio?.toString() || '',
          tipoOferta: p.tipoOferta,
          envio: envioVal,
          peso: p.peso,
          ubicacion: p.ubicacion,
          latitude: p.latitude,
          longitude: p.longitude,
        });
        this.locationConfirmed.set(true);

        // Images
        const imgs: any[] = [];
        if (p.imagenPrincipal) {
          imgs.push({ url: p.imagenPrincipal, isPrincipal: true, isExisting: true });
        }
        if (p.galeriaImagenes) {
          p.galeriaImagenes.forEach((url: string) => {
            imgs.push({ url, isPrincipal: false, isExisting: true });
          });
        }
        this.images.set(imgs);

        // Saltar a paso 1
        this.currentStep.set(1);
      },
      error: (err) => {
        this.toast.error('No se pudo cargar el producto para editar');
        this.router.navigate(['/perfil']);
      },
    });
  }

  @HostListener('mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    const step = this.currentStep();
    if (step === 0) {
      const cards = document.querySelectorAll('.select-card');
      cards.forEach((card) => {
        const rect = (card as HTMLElement).getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Cálculo para efecto 3D Tilt
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = ((y - centerY) / centerY) * -8;
        const rotateY = ((x - centerX) / centerX) * 8;

        const el = card as HTMLElement;
        el.style.setProperty('--mouse-x', `${x}px`);
        el.style.setProperty('--mouse-y', `${y}px`);
        el.style.setProperty('--rotate-x', `${rotateX}deg`);
        el.style.setProperty('--rotate-y', `${rotateY}deg`);
      });
    } else if (step === 2) {
      const wrappers = document.querySelectorAll('.premium-input-container, .premium-textarea-container');
      wrappers.forEach((w) => {
        const rect = (w as HTMLElement).getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const el = w as HTMLElement;
        el.style.setProperty('--mouse-x', `${x}px`);
        el.style.setProperty('--mouse-y', `${y}px`);
      });
    }
  }

  @HostListener('mouseleave', ['$event'])
  onMouseLeave(event: MouseEvent) {
    const cards = document.querySelectorAll('.select-card');
    cards.forEach((card) => {
      const el = card as HTMLElement;
      el.style.setProperty('--rotate-x', `0deg`);
      el.style.setProperty('--rotate-y', `0deg`);
    });
  }

  // ── FORMULARIOS ────────────────────────────────────────────────────
  private initForms(): void {
    // Ya inicializados arriba
  }

  private cargarCategorias(): void {
    this.http.get<Categoria[]>(`${environment.apiUrl}/categorias/raiz`).subscribe((res) => {
      // Filtrar categoría "Viajes" (Exclusiva para ofertas)
      const filtradas = res.filter(c => 
        c.slug?.toLowerCase() !== 'viajes' && 
        c.nombre?.toLowerCase() !== 'viajes'
      );
      this.categorias.set(filtradas);
    });
  }


  // ── NAVEGACIÓN ─────────────────────────────────────────────────────
  setStep0(type: string): void {
    if (this.isEditMode()) return;
    if (type === 'VEHICULO') this.router.navigate(['/publicar/vehiculo']);
    else if (type === 'OFERTA') this.router.navigate(['/publicar/oferta']);
    else if (type === 'SERVICIO') {
      // Por ahora los servicios siguen el flujo de producto con una categoría preseleccionada
      this.currentStep.set(1);
      const catServicio = this.categorias().find(
        (c) =>
          c.nombre.toLowerCase().includes('servicio') || c.slug.toLowerCase().includes('servicio'),
      );
      if (catServicio) this.selectCategory(catServicio);
    } else {
      this.currentStep.set(1);
    }
  }

  nextStep(): void {
    const s = this.currentStep();
    if (!this.canAdvance()) {
      this.handleValidationErrors(s);
      return;
    }

    if (s === 2) {
      this.validarModeracionYContinuar();
    } else {
      this.advance();
    }
  }

  private advance(): void {
    this.currentStep.update((s) => (s + 1) as PublishStep);
    window.scrollTo(0, 0);
  }

  private validarModeracionYContinuar(): void {
    const s2 = this.step2Form.getRawValue();
    const texto = `${s2.titulo} ${s2.descripcion}`;

    this.uploading.set(true);
    this.http.post<any>(`${environment.apiUrl}/api/moderation/check-text`, { texto }).subscribe({
      next: (res) => {
        this.uploading.set(false);
        if (res.apropiado) {
          this.advance();
        } else {
          this.toast.error(
            'No podemos incluir este tipo de palabras en el título o descripción al publicar un producto',
          );
        }
      },
      error: (err) => {
        this.uploading.set(false);
        if (err.status === 403 || err.status === 401) {
          this.toast.error('Error de permisos en la moderación. Contacta con soporte.');
        } else {
          // Si es un error de red o 500, permitimos avanzar para no bloquear al usuario por fallo del servicio
          // pero avisamos que el backend volverá a validar al final
          this.advance();
        }
      },
    });
  }

  private handleValidationErrors(s: number): void {
    if (s === 1) {
      this.step1Form.markAllAsTouched();
      if (!this.selectedCategory()) {
        this.toast.warning('Selecciona una categoría para tu producto');
        document
          .querySelector('.category-grid')
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (this.step1Form.get('condicion')?.invalid) {
        this.toast.warning('Selecciona el estado de conservación del producto');
        document
          .querySelector('.condition-grid')
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    const currentForm = this.getCurrentForm();
    if (currentForm) {
      currentForm.markAllAsTouched();
      this.toast.warning('Revisa los campos obligatorios en rojo');
      this.scrollToFirstError();
    } else if (s === 3 && !this.locationConfirmed()) {
      this.toast.warning('Confirma la ubicación seleccionándola de la lista');
      document
        .querySelector('.premium-location-input input')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  private getCurrentForm() {
    const s = this.currentStep();
    if (s === 1) return this.step1Form;
    if (s === 2) return this.step2Form;
    if (s === 3) return this.step3Form;
    return null;
  }

  private scrollToFirstError() {
    setTimeout(() => {
      const firstError = document.querySelector(
        '.ng-invalid.ng-touched, .select-card.invalid, .cat-card.invalid',
      );
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (firstError instanceof HTMLInputElement || firstError instanceof HTMLTextAreaElement) {
          firstError.focus();
        }
      }
    }, 100);
  }

  getErrorMessage(form: FormGroup, controlName: string): string {
    const control = form.get(controlName);
    if (!control || !control.invalid || (!control.dirty && !control.touched)) return '';
    if (control.hasError('required')) return 'Obligatorio';
    if (control.hasError('maxlength'))
      return `Máximo ${control.errors?.['maxlength'].requiredLength} caracteres`;
    if (control.hasError('min')) return `Mínimo ${control.errors?.['min'].min}`;
    return 'Inválido';
  }

  prevStep(): void {
    this.currentStep.update((s) => (s - 1) as PublishStep);
  }

  canAdvance(): boolean {
    const s = this.currentStep();
    if (s === 1) return this.step1Form.valid;
    if (s === 2) return this.step2Form.valid && this.images().length > 0;
    if (s === 3) return this.step3Form.valid && this.locationConfirmed();
    return true;
  }

  // ── CATEGORÍA ──────────────────────────────────────────────────────
  selectCategory(cat: Categoria): void {
    this.selectedCategory.set(cat);
    this.step1Form.patchValue({ categoriaId: cat.id });
  }

  // ── IMÁGENES ───────────────────────────────────────────────────────
  onFileSelected(event: any): void {
    const files: FileList = event.target.files;
    if (this.images().length + files.length > 8) {
      this.toast.warning('Máximo 8 fotos por producto');
      return;
    }
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.images.update((imgs) => [
          ...imgs,
          { url: e.target.result, file, isPrincipal: imgs.length === 0 },
        ]);
      };
      reader.readAsDataURL(file);
    });
  }

  moveImage(idx: number, direction: -1 | 1): void {
    const newImgs = [...this.images()];
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= newImgs.length) return;
    [newImgs[idx], newImgs[newIdx]] = [newImgs[newIdx], newImgs[idx]];
    newImgs.forEach((img, i) => (img.isPrincipal = i === 0));
    this.images.set(newImgs);
  }

  removeImage(i: number): void {
    this.images.update((imgs) => {
      const filtered = imgs.filter((_, idx) => idx !== i);
      filtered.forEach((img, idx) => (img.isPrincipal = idx === 0));
      return filtered;
    });
  }

  // ── DESCRIPCIÓN Y PEGADO DE IMÁGENES ───────────────────────────────
  formatText(type: string): void {
    const el = this.descInput?.nativeElement;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = el.value;
    const before = text.substring(0, start);
    const selected = text.substring(start, end);
    const after = text.substring(end);

    let result = '';
    let newCursorPos = end;

    switch (type) {
      case 'bold':
        result = before + `**${selected || 'texto'}**` + after;
        newCursorPos = selected ? end + 4 : start + 2;
        break;
      case 'italic':
        result = before + `*${selected || 'texto'}*` + after;
        newCursorPos = selected ? end + 2 : start + 1;
        break;
      case 'list':
        result = before + `\n- ${selected || 'elemento'}` + after;
        newCursorPos = selected ? end + 3 : start + 3;
        break;
      case 'header':
        result = before + `\n### ${selected || 'Título'}` + after;
        newCursorPos = selected ? end + 5 : start + 5;
        break;
    }

    if (result) {
      this.step2Form.patchValue({ descripcion: result });
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    }
  }

  @HostListener('window:paste', ['$event'])
  onPaste(event: ClipboardEvent): void {
    if (this.currentStep() !== 2) return;
    const items = event.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length > 0) {
      if (this.images().length + files.length > 8) {
        this.toast.warning('Máximo 8 fotos por producto');
        return;
      }
      files.forEach((file) => {
        const reader = new FileReader();
        reader.onload = (e: any) => {
          this.images.update((imgs) => [
            ...imgs,
            { url: e.target.result, file, isPrincipal: imgs.length === 0 },
          ]);
        };
        reader.readAsDataURL(file);
      });
    }
  }

  // ── GEOLOCALIZACIÓN ────────────────────────────────────────────────

  // ── PUBLICAR ───────────────────────────────────────────────────────
  async onSubmit(): Promise<void> {
    if (this.uploading()) return;

    if (!this.canAdvance()) {
      const currentForm = this.getCurrentForm();
      currentForm?.markAllAsTouched();
      this.toast.warning('Por favor, completa todos los requisitos antes de publicar');
      this.scrollToFirstError();
      return;
    }

    const uid = this.authStore.user()?.id;
    if (!uid) {
      this.toast.error('Debes estar identificado para publicar.');
      return;
    }

    this.uploading.set(true);

    const formData = new FormData();

    // Extraemos los valores de los formularios de forma limpia
    const s1 = this.step1Form.getRawValue();
    const s2 = this.step2Form.getRawValue();
    const s3 = this.step3Form.getRawValue();

    const productData = {
      titulo: s2.titulo,
      descripcion: s2.descripcion,
      marca: s2.marca,
      modelo: s2.modelo,
      precio: this.parsePrice(s3.precio),
      precioNegociable: s3.precioNegociable,
      tipoOferta: s3.tipoOferta,
      admiteEnvio: s3.envio !== 'NO',
      peso: s3.peso,
      ubicacion: s3.ubicacion,
      condicion: s1.condicion,
      estado: 'DISPONIBLE',
      categoria: { id: s1.categoriaId },
      latitude: s3.latitude,
      longitude: s3.longitude,
    };

    formData.append(
      'producto',
      new Blob([JSON.stringify(productData)], { type: 'application/json' }),
    );

    const principal = this.images().find((img) => img.isPrincipal);
    if (principal?.file) {
      formData.append('imagenPrincipal', principal.file);
    } else if (this.images().length > 0 && this.images()[0].file) {
      // Si no hay marcada como principal por algún motivo, cogemos la primera
      formData.append('imagenPrincipal', this.images()[0].file!);
    }

    this.images()
      .filter((img) => !img.isPrincipal && img.file)
      .forEach((img) => {
        formData.append('galeria', img.file!);
      });

    const obs = this.isEditMode()
      ? this.http.put(`${environment.apiUrl}/producto/${this.productId()}`, formData)
      : this.http.post(`${environment.apiUrl}/producto/publicar/${uid}`, formData);

    obs.subscribe({
      next: (res: any) => {
        const id = res.id || this.productId();
        this.router.navigate(['/productos', id || '']);
        this.toast.success(this.isEditMode() ? 'Producto actualizado' : '¡Producto publicado!');
      },
      error: (err) => {
        console.error('Error al guardar:', err);
        const msg = err.error?.error || 'Error inesperado al publicar el producto';
        this.toast.error(msg);
        this.uploading.set(false);
      },
    });
  }

  getCategoryIcon(cat: any): string {
    if (!cat) return 'fas fa-layer-group';
    const iconMap: { [key: string]: string } = {
      // Vehículos & Motor
      vehiculos: 'fas fa-car',
      coches: 'fas fa-car',
      coche: 'fas fa-car',
      motos: 'fas fa-motorcycle',
      moto: 'fas fa-motorcycle',
      'accesorios-vehiculos': 'fas fa-tools',

      // Inmuebles
      inmuebles: 'fas fa-building',
      alquiler: 'fas fa-key',

      // Electrónica & Tecnología
      electronica: 'fas fa-microchip',
      informatica: 'fas fa-laptop',
      telefonia: 'fas fa-mobile-screen-button',
      moviles: 'fas fa-mobile-screen-button',
      'tv-audio-foto': 'fas fa-camera',
      camaras: 'fas fa-camera',
      audio: 'fas fa-headphones',

      // Entretenimiento
      videojuegos: 'fas fa-gamepad',
      consolas: 'fas fa-gamepad',
      juguetes: 'fas fa-gamepad',
      libros: 'fas fa-book',
      musica: 'fas fa-music',

      // Hogar & Moda
      hogar: 'fas fa-house-user',
      muebles: 'fas fa-couch',
      electrodomesticos: 'fas fa-blender',
      moda: 'fas fa-shirt',
      ropa: 'fas fa-shirt',
      calzado: 'fas fa-shoe-prints',
      zapatillas: 'fas fa-shoe-prints',
      zapatos: 'fas fa-shoe-prints',

      // Otros
      otros: 'fas fa-ellipsis-h',
      servicios: 'fas fa-concierge-bell',
      deportes: 'fas fa-basketball',
      coleccionismo: 'fas fa-gem',
      bebes: 'fas fa-baby',
    };
    const slug = cat.slug?.toLowerCase();
    return iconMap[slug] || cat.icono || 'fas fa-tag';
  }

  getConditionIcon(val: string): string {
    const iconMap: { [key: string]: string } = {
      NUEVO: 'fas fa-star',
      COMO_NUEVO: 'fas fa-wand-magic-sparkles',
      MUY_BUEN_ESTADO: 'fas fa-check-double',
      BUEN_ESTADO: 'fas fa-check',
      ACEPTABLE: 'fas fa-thumbs-up',
    };
    return iconMap[val] || 'fas fa-tag';
  }
}
