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
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable, startWith, delay, of, debounceTime, distinctUntilChanged, switchMap, filter } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { AuthStore } from '../../../core/auth/auth-store';
import { SearchService } from '../../../core/services/search.service';
import { ToastService } from '../../../core/services/toast.service';
import { Categoria } from '../../../models/categoria.model';
import { OfertaCardComponent } from '../../../shared/components/marketplace/oferta-card/oferta-card.component';

@Component({
  selector: 'app-publish-oferta',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, OfertaCardComponent],
  templateUrl: './publish-oferta.component.html',
  styleUrls: ['./publish-oferta.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublishOfertaComponent implements OnInit {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private router = inject(Router);
  private authStore = inject(AuthStore);
  private searchService = inject(SearchService);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);

  categorias = signal<Categoria[]>([]);
  selectedCategory = signal<Categoria | null>(null);
  images = signal<{ url: string; file?: File; isPrincipal: boolean }[]>([]);
  uploading = signal(false);
  verificandoLink = signal(false);
  linkVerificado = signal(false);
  favicon = signal<string | null>(null);
  sugerenciasUbi = signal<any[]>([]);
  buscandoUbi = signal(false);
  locationConfirmed = signal(false);

  isEditMode = signal(false);
  ofertaId = signal<number | null>(null);

  @ViewChild('descInput') descInput!: ElementRef<HTMLTextAreaElement>;

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
    if (ico && !ico.includes('fas') && !ico.includes('fab') && !ico.includes('far'))
      ico = 'fas ' + ico;

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
      'Inmobiliaria': 'Venta y alquiler de inmuebles',
      'Viajes': 'Vuelos, hoteles y escapadas increíbles'
    };
    return descs[name] || 'Explora esta categoría';
  }

  ofertaForm = this.fb.group({
    urlOferta: ['', [Validators.required, Validators.pattern(/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/)]],
    titulo: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(100)]],
    descripcion: ['', [Validators.required, Validators.minLength(20), Validators.maxLength(1000)]],
    precioOferta: ['', [Validators.required, Validators.pattern(/^[0-9]+([.,][0-9]{0,2})?$/)]],
    precioOriginal: ['', [Validators.pattern(/^[0-9]+([.,][0-9]{0,2})?$/)]],
    tienda: ['', [Validators.required]],
    codigoDescuento: [''],
    esOnline: [true],
    esGratis: [false],
    ciudadOferta: [''],
    latitude: [null as number | null],
    longitude: [null as number | null],
    gastosEnvio: [null as number | null],
    fechaExpiracion: [''],
  });

  formValue = toSignal(this.ofertaForm.valueChanges.pipe(startWith(this.ofertaForm.value), debounceTime(50)));

  previewOferta = computed(() => {
    const val = this.formValue();
    const imgs = this.images();
    
    const priceOff = this.parsePrice(val?.precioOferta);
    const priceOrig = this.parsePrice(val?.precioOriginal);
    
    return {
      id: 9999,
      titulo: val?.titulo || 'Título de tu oferta',
      precio: priceOff,
      precioOferta: priceOff || undefined,
      precioOriginal: priceOrig || undefined,
      // Si no hay imágenes, usamos un placeholder profesional de Nexus
      imagenPrincipal: imgs.length > 0 ? imgs[0].url : 'https://images.unsplash.com/photo-1555421689-491a97ff2040?q=80&w=1000&auto=format&fit=crop', 
      tienda: val?.tienda || 'Tienda',
      fechaPublicacion: new Date(),
      fechaExpiracion: val?.fechaExpiracion ? new Date(val.fechaExpiracion) : undefined,
      badge: this.calculateBadge(priceOff, priceOrig),
      sparkCount: 42,
      dripCount: 5,
      miVoto: null,
      searchType: 'OFERTA' as const
    } as any;
  });

  discountPercent = computed(() => {
    const val = this.formValue();
    const off = this.parsePrice(val?.precioOferta);
    const orig = this.parsePrice(val?.precioOriginal);
    if (!off || !orig || orig <= off) return 0;
    return Math.round(((orig - off) / orig) * 100);
  });

  parsePrice(val: any): number {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    const str = String(val).replace(',', '.');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  }

  onPriceInput(event: any, controlName: string): void {
    const input = event.target;
    let value = input.value;
    const parts = value.split(/[.,]/);
    if (parts.length > 2) {
      value = parts[0] + '.' + parts.slice(1).join('');
    }
    if (parts.length === 2 && parts[1].length > 2) {
      value = parts[0] + (value.includes(',') ? ',' : '.') + parts[1].substring(0, 2);
    }
    input.value = value;
    this.ofertaForm.get(controlName)?.setValue(value, { emitEvent: false });
  }

  ngOnInit(): void {
    if (!this.authStore.isLoggedIn()) { this.router.navigate(['/login']); return; }
    this.cargarCategorias();
    this.setupLocationSearch();

    this.ofertaForm.get('esGratis')?.valueChanges.subscribe(isGratis => {
      const priceControl = this.ofertaForm.get('precioOferta');
      const originalPriceControl = this.ofertaForm.get('precioOriginal');
      if (isGratis) {
        priceControl?.setValue('0');
        priceControl?.disable();
        // El precio original se deja habilitado para mostrar valor previo
        originalPriceControl?.enable();
      } else {
        priceControl?.enable();
        originalPriceControl?.enable();
      }
    });

    this.route.paramMap.subscribe(params => {
      const idStr = params.get('id');
      if (idStr) {
        this.isEditMode.set(true);
        this.ofertaId.set(Number(idStr));
        this.cargarOfertaParaEdicion(Number(idStr));
      }
    });
  }

  private cargarOfertaParaEdicion(id: number): void {
    this.http.get<any>(`${environment.apiUrl}/oferta/${id}`).subscribe({
      next: (oferta) => {
        this.selectedCategory.set(oferta.categoria || null);
        this.ofertaForm.patchValue({
          urlOferta: oferta.urlOferta,
          titulo: oferta.titulo,
          descripcion: oferta.descripcion,
          precioOferta: oferta.precioOferta?.toString() || '',
          precioOriginal: oferta.precioOriginal?.toString() || '',
          tienda: oferta.tienda,
          codigoDescuento: oferta.codigoDescuento,
          esOnline: oferta.esOnline,
          esGratis: oferta.esGratis,
          ciudadOferta: oferta.ciudadOferta,
          latitude: oferta.latitude,
          longitude: oferta.longitude,
          gastosEnvio: oferta.gastosEnvio,
          fechaExpiracion: oferta.fechaExpiracion ? new Date(oferta.fechaExpiracion).toISOString().substring(0, 16) : ''
        });
        
        if (oferta.imagenPrincipal) {
            this.images.update(imgs => [...imgs, { url: oferta.imagenPrincipal, isPrincipal: true }]);
        }
        if (oferta.galeria && oferta.galeria.length > 0) {
            oferta.galeria.forEach((imgUrl: string) => {
                this.images.update(imgs => [...imgs, { url: imgUrl, isPrincipal: false }]);
            });
        }
      },
      error: () => this.toast.error('Error al cargar la oferta')
    });
  }

  private cargarCategorias(): void {
    this.http.get<Categoria[]>(`${environment.apiUrl}/categorias/raiz`).subscribe({
      next: (res) => this.categorias.set(res),
      error: (err) => console.error(err)
    });
  }

  getIconPath(cat: Categoria): string {
    return this.getIconoCategoria(cat);
  }

  private calculateBadge(off?: number | null, orig?: number | null): string {
    if (off !== undefined && off !== null && off <= 0) return 'GRATUITA';
    if (!off || !orig || orig <= 0) return 'NUEVA';
    const pct = Math.round(((orig - off) / orig) * 100);
    return pct >= 50 ? 'CHOLLAZO' : 'PORCENTAJE';
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
        this.ofertaForm.patchValue({ descripcion: result });
        setTimeout(() => {
            el.focus();
            el.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
    }
  }

  @HostListener('window:paste', ['$event'])
  onPaste(event: ClipboardEvent): void {
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
        if (this.images().length + files.length > 5) {
            alert('Máximo 5 fotos por oferta'); // Asumimos alert o hay toast
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

  verifyLink(): void {
    const url = this.ofertaForm.get('urlOferta')?.value;
    if (!url || this.ofertaForm.get('urlOferta')?.invalid) return;
    this.verificandoLink.set(true);
    of(true).pipe(delay(800)).subscribe(() => {
      this.verificandoLink.set(false);
      this.linkVerificado.set(true);
      try {
        const urlObj = new URL(url.startsWith('http') ? url : 'https://' + url);
        const hostname = urlObj.hostname.replace('www.', '');
        const domain = hostname.split('.')[0];
        if (!this.ofertaForm.get('tienda')?.value) {
          this.ofertaForm.patchValue({ tienda: domain.charAt(0).toUpperCase() + domain.slice(1) });
        }
        this.favicon.set(`https://www.google.com/s2/favicons?domain=${hostname}&sz=64`);
      } catch(e) {}
    });
  }

  onFileSelected(event: any): void {
    const files: FileList = event.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.images.update((imgs) => [...imgs, { url: e.target.result, file, isPrincipal: imgs.length === 0 }]);
      };
      reader.readAsDataURL(file);
    });
  }

  removeImage(i: number): void {
    this.images.update((imgs) => {
      const filtered = imgs.filter((_, idx) => idx !== i);
      filtered.forEach((img, idx) => (img.isPrincipal = idx === 0));
      return filtered;
    });
  }

  selectCategory(cat: Categoria): void { this.selectedCategory.set(cat); }

  private setupLocationSearch(): void {
    (this.ofertaForm.get('ciudadOferta')?.valueChanges as Observable<string | null>).pipe(
      filter((q): q is string => !!q && q.length > 1),
      debounceTime(400),
      distinctUntilChanged(),
      switchMap((q: string) => this.searchService.buscarUbicacionEstructurada(q))
    ).subscribe(res => this.sugerenciasUbi.set(res));
  }

  selectUbi(u: any): void {
    const cityName = u.display || u;
    this.ofertaForm.patchValue({ 
      ciudadOferta: cityName,
      latitude: u.lat ?? null,
      longitude: u.lng ?? null
    }, { emitEvent: false });
    this.locationConfirmed.set(true);
    this.sugerenciasUbi.set([]);
  }

  useLocation(): void {
    if (!navigator.geolocation) return;
    this.buscandoUbi.set(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.http.get<any>(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`)
          .subscribe({
            next: (res) => {
              const ciudad = res?.address?.city || res?.address?.town || res?.address?.village || '';
              if (ciudad) {
                this.ofertaForm.patchValue({ 
                  ciudadOferta: ciudad,
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude
                });
                this.locationConfirmed.set(true);
              }
              this.buscandoUbi.set(false);
            },
            error: () => this.buscandoUbi.set(false)
          });
      },
      () => this.buscandoUbi.set(false)
    );
  }

  updateMousePos(e: MouseEvent) {
    const card = e.currentTarget as HTMLElement;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    card.style.setProperty('--mouse-x', `${x}px`);
    card.style.setProperty('--mouse-y', `${y}px`);
  }

  getErrorMessage(controlName: string): string {
    const control = this.ofertaForm.get(controlName);
    if (!control || !control.invalid || !control.touched) return '';
    if (control.hasError('required')) return 'Obligatorio';
    if (control.hasError('minlength')) return `Mín ${control.errors?.['minlength'].requiredLength} carac.`;
    if (control.hasError('pattern')) return 'URL no válida';
    return 'Inválido';
  }

  private scrollToFirstError() {
    setTimeout(() => {
      const firstError = document.querySelector('.ng-invalid.ng-touched, .cat-card.invalid');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (firstError instanceof HTMLInputElement || firstError instanceof HTMLTextAreaElement) {
          firstError.focus();
        }
      }
    }, 100);
  }

  async onSubmit(): Promise<void> {
    if (this.uploading()) return;

    if (this.ofertaForm.invalid || !this.selectedCategory()) {
      this.ofertaForm.markAllAsTouched();
      
      if (!this.selectedCategory()) {
        this.toast.warning('Selecciona una categoría para tu oferta');
        document.querySelector('.category-grid')?.scrollIntoView({ behavior: 'smooth' });
      } else {
        this.toast.warning('Revisa los campos obligatorios marcados en rojo');
        this.scrollToFirstError();
      }
      return;
    }

    if (this.images().length === 0) {
      this.toast.warning('Sube al menos una imagen de la oferta');
      document.querySelector('.upload-zone')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    if (this.ofertaForm.get('ciudadOferta')?.value && !this.locationConfirmed()) {
        this.toast.warning('Confirma la ubicación seleccionándola de la lista');
        document.querySelector('.location-group-elite')?.scrollIntoView({ behavior: 'smooth' });
        return;
    }

    this.validarModeracionYEnviar();
  }

  private validarModeracionYEnviar(): void {
    const val = this.ofertaForm.getRawValue();
    const texto = `${val.titulo} ${val.descripcion}`;

    this.uploading.set(true);
    this.http.post<any>(`${environment.apiUrl}/api/moderation/check-text`, { texto }).subscribe({
      next: (res) => {
        if (res.apropiado) {
          this.procederConEnvio();
        } else {
          this.uploading.set(false);
          this.toast.error('No podemos incluir este tipo de palabras en el título o descripción al publicar una oferta');
        }
      },
      error: (err) => {
        this.uploading.set(false);
        if (err.status === 403 || err.status === 401) {
          this.toast.error('Error de permisos en la moderación. Contacta con soporte.');
        } else {
          // En caso de error de red (no 403/401), intentamos enviar igual (el backend volverá a validar)
          this.procederConEnvio();
        }
      }
    });
  }

  private procederConEnvio(): void {
    const formData = new FormData();
    const val = this.ofertaForm.getRawValue();
    const ofertaData = { 
      ...val, 
      precioOferta: this.parsePrice(val.precioOferta),
      precioOriginal: this.parsePrice(val.precioOriginal),
      fechaExpiracion: val.fechaExpiracion ? val.fechaExpiracion : null,
      categoria: { id: this.selectedCategory()?.id } 
    };
    formData.append('oferta', new Blob([JSON.stringify(ofertaData)], { type: 'application/json' }));
    
    // Identificar imagen principal (ya sea un File nuevo o una URL existente)
    const principal = this.images().find(img => img.isPrincipal) || this.images()[0];
    if (principal?.file) formData.append('imagenPrincipal', principal.file);
    
    this.images().filter(img => img !== principal && img.file).forEach(img => formData.append('galeria', img.file!));
    
    const obs$ = this.isEditMode() 
      ? this.http.put(`${environment.apiUrl}/oferta/${this.ofertaId()}`, formData)
      : this.http.post(`${environment.apiUrl}/oferta/${this.authStore.user()?.id}`, formData);

    obs$.subscribe({
      next: (res: any) => this.router.navigate(['/search'], { queryParams: { q: res.titulo, tipo: 'OFERTA' } }),
      error: () => this.uploading.set(false)
    });
  }
}
