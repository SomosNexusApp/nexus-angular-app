import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy, ViewChild, ElementRef, HostListener, effect, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { debounceTime, distinctUntilChanged, switchMap, of, startWith, tap, catchError } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';

import { environment } from '../../../../environments/environment';
import { AuthStore } from '../../../core/auth/auth-store';
import { SearchService } from '../../../core/services/search.service';
import { ToastService } from '../../../core/services/toast.service';
import { TipoVehiculo } from '../../../models/vehiculo.model';

export type PublishStep = 1 | 2 | 3 | 4 | 5;

@Component({
  selector: 'app-publish-vehiculo',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './publish-vehiculo.component.html',
  styleUrls: ['./publish-vehiculo.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublishVehiculoComponent implements OnInit, AfterViewInit {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private router = inject(Router);
  private authStore = inject(AuthStore);
  private searchService = inject(SearchService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  private sanitizer = inject(DomSanitizer);

  currentStep = signal<PublishStep>(1);
  uploading = signal(false);
  images = signal<{ url: string; file?: File; isPrincipal: boolean }[]>([]);
  
  isEditMode = signal(false);
  vehiculoId = signal<number | null>(null);

  // Custom Dropdown State
  activeDropdown = signal<string | null>(null);

  // Combustible options
  combustibleOptions = [
    { value: 'GASOLINA', label: 'Gasolina', icon: 'zap' },
    { value: 'DIESEL', label: 'Diésel', icon: 'droplet' },
    { value: 'ELECTRICO', label: 'Eléctrico', icon: 'battery-charging' },
    { value: 'HIBRIDO', label: 'Híbrido', icon: 'leaf' },
    { value: 'GAS', label: 'Gas (GLP/GNC)', icon: 'wind' }
  ];

  // Cambio options
  cambioOptions = [
    { value: 'MANUAL', label: 'Manual', icon: 'settings' },
    { value: 'AUTOMATICO', label: 'Automático', icon: 'cpu' }
  ];

  // Tipo oferta options
  tipoOfertaOptions = [
    { value: 'VENTA', label: 'Venta Directa', icon: 'tag' },
    { value: 'INTERCAMBIO', label: 'Intercambio / Acepta cambios', icon: 'refresh-cw' }
  ];

  @ViewChild('descInput') descInput!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('visualEditor') visualEditor!: ElementRef<HTMLDivElement>;

  // --- FORMULARIOS ---
  step1Form = this.fb.group({
    tipoVehiculo: this.fb.control<TipoVehiculo | null>(null, Validators.required)
  });

  step2Form = this.fb.group({
    marca: this.fb.control<string>('', [Validators.required, Validators.minLength(2)]),
    modelo: this.fb.control<string>('', [Validators.required, Validators.minLength(1)]),
    anio: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(1900),
      Validators.max(new Date().getFullYear() + 1)
    ]),
    kilometros: this.fb.control<number | null>(null, [Validators.required, Validators.min(0), Validators.max(2000000)]),
    combustible: this.fb.control<string>('GASOLINA', Validators.required),
    cambio: this.fb.control<string>('MANUAL', Validators.required),
    potencia: this.fb.control<number | null>(null, [Validators.min(1), Validators.max(2000)]),
    cilindrada: this.fb.control<number | null>(null, [Validators.min(49), Validators.max(10000)]),
    color: this.fb.control<string>('', [Validators.required, Validators.minLength(3)]),
    numeroPuertas: this.fb.control<number | null>(null),
    plazas: this.fb.control<number | null>(null, [Validators.required, Validators.min(1), Validators.max(100)]),
    itv: this.fb.control<boolean>(false),
    garantia: this.fb.control<boolean>(false),
  });

  step3Form = this.fb.group({
    condicion: this.fb.control<string>('MUY_BUEN_ESTADO', Validators.required),
    precio: this.fb.control<string>('', [Validators.required, Validators.pattern(/^[0-9]+([.,][0-9]{0,2})?$/)]),
    tipoOferta: this.fb.control<string>('VENTA', Validators.required),
    matricula: this.fb.control<string>('', [
      Validators.pattern(/^[0-9]{4}[A-Z]{3}$|^[A-Z]{1,2}[0-9]{4}[A-Z]{1,2}$/)
    ]),
    ubicacion: this.fb.control<string>('', Validators.required),
    ciudad: this.fb.control<string>(''),
    provincia: this.fb.control<string>(''),
    cp: this.fb.control<string>('')
  });

  // Reactive Values for Icons (defined after forms)
  combustibleValue = toSignal(this.step2Form.get('combustible')!.valueChanges.pipe(startWith('GASOLINA')), { initialValue: 'GASOLINA' });
  cambioValue = toSignal(this.step2Form.get('cambio')!.valueChanges.pipe(startWith('MANUAL')), { initialValue: 'MANUAL' });
  tipoOfertaValue = toSignal(this.step3Form.get('tipoOferta')!.valueChanges.pipe(startWith('VENTA')), { initialValue: 'VENTA' });
  
  marcaInput = toSignal(this.step2Form.get('marca')!.valueChanges.pipe(startWith('')), { initialValue: '' });
  modeloInput = toSignal(this.step2Form.get('modelo')!.valueChanges.pipe(startWith('')), { initialValue: '' });

  step4Form = this.fb.group({
    titulo: this.fb.control<string>('', [Validators.required, Validators.minLength(10), Validators.maxLength(80)]),
    descripcion: this.fb.control<string>('', [Validators.required, Validators.minLength(20), Validators.maxLength(2000)]),
  });

  // --- AUTOCOMPLETE SIGNALS ---
  marcasRaw = toSignal(this.searchService.getMarcasVehiculos(), { initialValue: [] as any[] });
  showMarcas = signal(false);
  filteredMarcas = computed(() => {
    const q = (this.marcaInput() || '').toLowerCase();
    const all = this.marcasRaw();
    return all
      .filter(m => m.name.toLowerCase().includes(q))
      .map(m => ({ ...m, flag: this.getFlagEmoji(m.country) }))
      .slice(0, 50);
  });

  modelosRaw = signal<string[]>([]);
  showModelos = signal(false);
  filteredModelos = computed(() => {
    const q = (this.modeloInput() || '').toLowerCase();
    const all = this.modelosRaw();
    return all
      .filter(m => m.toLowerCase().includes(q))
      .slice(0, 50);
  });

  sugerenciasUbi = signal<any[]>([]);
  showUbi = signal<boolean>(false);

  // Writing Assistant
  descriptionWordCount = signal(0);
  descriptionCharCount = signal(0);
  
  isSearchingModelos = signal(false);
  isSearchingUbi = signal(false);
  
  writingTemplates = [
    {
      id: 'professional',
      name: 'Profesional',
      icon: 'briefcase',
      content: `<h3>Estado General</h3>Excelente estado de conservación, siempre en garaje.<br><br><h3>Mantenimiento</h3>Libro de revisiones al día en servicio oficial. ITV recién pasada.<br><br><h3>Equipamiento Destacado</h3><ul><li>Pack AMG / M / S-Line</li><li>Techo panorámico</li><li>Asistentes de conducción avanzada</li></ul><br><h3>Otros Detalles</h3>Neumáticos nuevos y pintura original.`
    },
    {
      id: 'enthusiast',
      name: 'Entusiasta',
      icon: 'flame',
      content: `<h3>Sensaciones</h3>Un vehículo diseñado para disfrutar de la conducción. Respuesta inmediata y manejo deportivo.<br><br><h3>Modificaciones y Extras</h3>Equipamiento premium seleccionado para mejorar la experiencia dinámica.<br><br><h3>Cuidado Personal</h3>Lavado siempre a mano, detallado periódico y mecánicamente impecable.`
    },
    {
      id: 'technical',
      name: 'Técnico',
      icon: 'cpu',
      content: `<h3>Ficha Técnica Detallada</h3>Motorización optimizada, consumos reales de X l/100km.<br><br><h3>Historial Mecánico</h3>Último cambio de aceite y filtros hace X km. Discos y pastillas en buen estado.<br><br><h3>Conectividad</h3>Sistema de infoentretenimiento compatible con Apple CarPlay y Android Auto.`
    }
  ];

  constructor() {
    // Carga de Modelos al cambiar Marca
    this.step2Form.get('marca')?.valueChanges.pipe(
      distinctUntilChanged(),
      tap(() => this.isSearchingModelos.set(true)),
      switchMap(marca => {
        if (!marca) return of([]);
        const q = typeof marca === 'string' ? marca.toLowerCase() : '';
        const brandObj = typeof marca === 'object' ? marca : 
                        this.marcasRaw().find((m: any) => m.name.toLowerCase() === q);
        
        const name = brandObj?.name || (typeof marca === 'string' ? marca : '');
        
        if (name) {
          return this.searchService.getModelosPorMarca(name).pipe(
            catchError(() => of([]))
          );
        }
        return of([]);
      }),
      catchError(err => {
        console.error('Error in marca valueChanges pipe:', err);
        return of([]);
      })
    ).subscribe(mods => {
      this.isSearchingModelos.set(false);
      const cleanMods = (mods || []).map(m => m.split('(')[0].trim()).filter(m => m.length > 0);
      const uniqueMods = [...new Set(cleanMods)];
      this.modelosRaw.set(uniqueMods.sort((a, b) => a.localeCompare(b)));
    });

    // Ubicación OSM
    this.step3Form.get('ubicacion')?.valueChanges.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      tap(q => { if(q && q.length > 1) this.isSearchingUbi.set(true); }),
      switchMap(q => q && q.length > 1 ? this.searchService.buscarUbicacionEstructurada(q) : of([]))
    ).subscribe(res => {
      this.isSearchingUbi.set(false);
      this.sugerenciasUbi.set(res);
      this.showUbi.set(res.length > 0 || (this.step3Form.get('ubicacion')?.value?.length || 0) > 1);
    });

    // Re-inicializar iconos de Lucide al cambiar de paso o abrir dropdown o cambiar valores clave
    effect(() => {
      this.currentStep();
      this.activeDropdown();
      this.combustibleValue();
      this.cambioValue();
      this.tipoOfertaValue();
      this.initIcons(50);
      this.initIcons(200);
    });
  }

  onFocusMarca() {
    this.showMarcas.set(true);
    this.showModelos.set(false);
    this.showUbi.set(false);
  }

  onFocusModelo() {
    this.showModelos.set(true);
    this.showMarcas.set(false);
    this.showUbi.set(false);
  }

  onInputMarca() { this.showMarcas.set(this.step2Form.get('marca')?.value ? true : false); }
  onInputModelo() { this.showModelos.set(this.step2Form.get('modelo')?.value ? true : false); }
  onInputUbi() { this.showUbi.set(this.step3Form.get('ubicacion')?.value ? true : false); }

  toggleDropdown(name: string) {
    if (this.activeDropdown() === name) {
      this.activeDropdown.set(null);
    } else {
      this.activeDropdown.set(name);
      this.initIcons(50);
    }
  }

  selectOption(formName: 'step2Form' | 'step3Form', controlName: string, value: any) {
    const form = (this as any)[formName];
    form.get(controlName)?.setValue(value);
    this.activeDropdown.set(null);
  }

  getSelectedLabel(formName: 'step2Form' | 'step3Form', controlName: string, options: any[]): string {
    const form = (this as any)[formName];
    const value = form.get(controlName)?.value;
    return options.find(o => o.value === value)?.label || 'Seleccionar...';
  }

  getSelectedIcon(formName: 'step2Form' | 'step3Form', controlName: string, options: any[]): string {
    const form = (this as any)[formName];
    const value = form.get(controlName)?.value;
    return options.find(o => o.value === value)?.icon || 'chevron-down';
  }

  onPriceInput(event: any): void {
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
    this.step3Form.get('precio')?.setValue(value, { emitEvent: false });
  }

  parsePrice(val: any): number {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    const str = String(val).replace(',', '.');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  }

  getIconSvg(name: string): SafeHtml {
    const icons: { [key: string]: string } = {
      'zap': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-zap"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>',
      'droplet': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-droplet"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5s-3 3.5-3 5.5a7 7 0 0 0 7 7z"></path></svg>',
      'battery-charging': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-battery-charging"><path d="M15 7h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-1M5 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h1M11 7l-3 5h4l-3 5"></path></svg>',
      'leaf': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-leaf"><path d="M11 20a7 7 0 0 1-7-7c0-5.5 4.5-10 10-10 0 0 4 0 6 2s2 6 2 6c0 5.5-4.5 10-10 10z"></path><path d="M11 20l1-5"></path><path d="M21 4l-5 5"></path></svg>',
      'wind': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-wind"><path d="M17.7 7.7A2.5 2.5 0 1 1 20 12H3"></path><path d="M9.6 17a2.5 2.5 0 1 1-2.2-4.4H21"></path><path d="M7 5a2.5 2.5 0 1 1 2.2 4.4H3"></path></svg>',
      'settings': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-settings"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
      'cpu': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-cpu"><rect x="4" y="4" width="16" height="16" rx="2"></rect><rect x="9" y="9" width="6" height="6"></rect><path d="M15 2v2"></path><path d="M15 20v2"></path><path d="M2 15h2"></path><path d="M2 9h2"></path><path d="M20 15h2"></path><path d="M20 9h2"></path><path d="M9 2v2"></path><path d="M9 20v2"></path></svg>',
      'tag': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-tag"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2z"></path><path d="M7 7h.01"></path></svg>',
      'refresh-cw': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-refresh-cw"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path><path d="M3 21v-5h5"></path></svg>',
      'shopping-cart': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shopping-cart"><circle cx="8" cy="21" r="1"></circle><circle cx="19" cy="21" r="1"></circle><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path></svg>',
      'fuel': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-fuel"><path d="M3 22L15 22"></path><path d="M4 9L14 9"></path><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"></path><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2h.5a1.5 1.5 0 0 0 1.5-1.5V11"></path><path d="M15 22h-2"></path><path d="M9 9v3"></path></svg>',
      'activity': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-activity"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>',
      'bold': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bold"><path d="M14 12a4 4 0 0 0 0-8H6v8"></path><path d="M15 20a4 4 0 0 0 0-8H6v8Z"></path></svg>',
      'italic': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-italic"><line x1="19" x2="10" y1="4" y2="4"></line><line x1="14" x2="5" y1="20" y2="20"></line><line x1="15" x2="9" y1="4" y2="20"></line></svg>',
      'list': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-list"><line x1="8" x2="21" y1="6" y2="6"></line><line x1="8" x2="21" y1="12" y2="12"></line><line x1="8" x2="21" y1="18" y2="18"></line><line x1="3" x2="3.01" y1="6" y2="6"></line><line x1="3" x2="3.01" y1="12" y2="12"></line><line x1="3" x2="3.01" y1="18" y2="18"></line></svg>',
      'heading': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-heading"><path d="M6 12h12"></path><path d="M6 20V4"></path><path d="M18 20V4"></path></svg>',
      'trash-2': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-2"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" x2="10" y1="11" y2="17"></line><line x1="14" x2="14" y1="11" y2="17"></line></svg>',
      'image': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-image"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path></svg>',
      'upload-cloud': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-upload-cloud"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path><path d="M12 12v9"></path><path d="m8 16 4-4 4 4"></path></svg>',
      'plus': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-plus"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>',
      'type': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-type"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" x2="15" y1="20" y2="20"></line><line x1="12" x2="12" y1="4" y2="20"></line></svg>',
      'align-left': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-align-left"><line x1="21" x2="3" y1="6" y2="6"></line><line x1="15" x2="3" y1="12" y2="12"></line><line x1="17" x2="3" y1="18" y2="18"></line></svg>',
      'briefcase': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-briefcase"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>',
      'flame': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-flame"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>',
      'sparkles': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sparkles"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275l-5.813 1.912 5.813 1.912a2 2 0 0 1 1.275 1.275l1.912 5.813 1.912-5.813a2 2 0 0 1 1.275-1.275l5.813-1.912-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path><path d="M5 3v4"></path><path d="M19 17v4"></path><path d="M3 5h4"></path><path d="M17 19h4"></path></svg>',
      'gauge': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-gauge"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>',
      'calendar': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-calendar"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>',
      'palette': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-palette"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.6-.7 1.6-1.6 0-.4-.1-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.7-1.6 1.6-1.6H17c2.8 0 5-2.2 5-5 0-4.4-4.5-8-10-8Z"/></svg>'
    };
    const svg = icons[name] || '';
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.custom-select-container')) {
      this.activeDropdown.set(null);
    }
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

  ngOnInit(): void {
    if (!this.authStore.isLoggedIn()) {
      this.router.navigate(['/login']);
    }

    this.route.paramMap.subscribe(params => {
      const idStr = params.get('id');
      if (idStr) {
        this.isEditMode.set(true);
        this.vehiculoId.set(Number(idStr));
        this.cargarVehiculoParaEdicion(Number(idStr));
      }
    });
  }

  private cargarVehiculoParaEdicion(id: number): void {
    this.http.get<any>(`${environment.apiUrl}/vehiculo/${id}`).subscribe({
      next: (v) => {
        // Mapear datos a los formularios
        this.step1Form.patchValue({ tipoVehiculo: v.tipoVehiculo });
        this.step2Form.patchValue({
          marca: v.marca,
          modelo: v.modelo,
          anio: v.anio,
          kilometros: v.kilometros,
          combustible: v.combustible,
          cambio: v.cambio,
          potencia: v.potencia,
          cilindrada: v.cilindrada,
          color: v.color,
          numeroPuertas: v.numeroPuertas,
          plazas: v.plazas,
          itv: v.itv,
          garantia: v.garantia
        });
        this.step3Form.patchValue({
          condicion: v.condicion,
          precio: v.precio?.toString() || '',
          tipoOferta: v.tipoOferta,
          matricula: v.matricula,
          ubicacion: v.ubicacion
        });
        this.step4Form.patchValue({
          titulo: v.titulo,
          descripcion: v.descripcion
        });

        // Imágenes
        if (v.imagenPrincipal) {
          this.images.update(imgs => [...imgs, { url: v.imagenPrincipal, isPrincipal: true }]);
        }
        if (v.galeriaImagenes && v.galeriaImagenes.length > 0) {
          v.galeriaImagenes.forEach((url: string) => {
            this.images.update(imgs => [...imgs, { url, isPrincipal: false }]);
          });
        }
      },
      error: () => this.toast.error('Error al cargar el vehículo')
    });
  }



  selectTipo(tipo: TipoVehiculo) {
    this.step1Form.patchValue({ tipoVehiculo: tipo });
  }

  selectMarca(m: any) {
    const brandName = (m && typeof m === 'object') ? m.name : m;
    this.step2Form.get('marca')?.setValue(brandName, { emitEvent: true });
    this.showMarcas.set(false);
    this.step2Form.get('modelo')?.setValue(''); 
  }

  selectModelo(m: string) {
    this.step2Form.get('modelo')?.setValue(m, { emitEvent: true });
    this.showModelos.set(false);
  }

  selectUbi(ubi: any) {
    this.step3Form.patchValue({
      ubicacion: ubi.display,
      ciudad: ubi.ciudad,
      provincia: ubi.provincia,
      cp: ubi.cp
    });
    this.showUbi.set(false);
  }

  updateMousePos(e: MouseEvent) {
    const card = e.currentTarget as HTMLElement;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    card.style.setProperty('--mouse-x', `${x}px`);
    card.style.setProperty('--mouse-y', `${y}px`);
  }

  cerrarPaneles() {
    setTimeout(() => {
      this.showMarcas.set(false);
      this.showModelos.set(false);
      this.showUbi.set(false);
    }, 250);
  }

  getErrorMessage(form: any, controlName: string): string {
    const control = form.get(controlName);
    // SOLO mostrar si ha sido interactuado
    if (!control || !control.invalid || (!control.dirty && !control.touched)) return '';
    
    if (control.hasError('required')) return 'Obligatorio';
    if (control.hasError('min')) return `Mín: ${control.errors?.['min'].min}`;
    if (control.hasError('max')) return `Máx: ${control.errors?.['max'].max}`;
    if (control.hasError('minlength')) return `Mín ${control.errors?.['minlength'].requiredLength} carac.`;
    if (control.hasError('pattern')) return 'Formato incorrecto';
    return 'Inválido';
  }

  private scrollToFirstError() {
    setTimeout(() => {
      const firstError = document.querySelector('.ng-invalid.ng-touched');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Si es un input, darle foco
        (firstError as HTMLElement).focus();
      }
    }, 100);
  }

  nextStep() {
    const s = this.currentStep();
    if (!this.canAdvance()) {
      this.handleValidationErrors(s);
      return;
    }

    if (s === 4) {
      this.validarModeracionYContinuar();
    } else {
      this.advance();
    }
  }

  private advance(): void {
    this.currentStep.update(s => (s + 1) as PublishStep);
    window.scrollTo(0, 0);
  }

  private validarModeracionYContinuar(): void {
    const s4 = this.step4Form.getRawValue();
    const texto = `${s4.titulo} ${s4.descripcion}`;
    
    this.uploading.set(true);
    this.http.post<any>(`${environment.apiUrl}/api/moderation/check-text`, { texto }).subscribe({
      next: (res) => {
        this.uploading.set(false);
        if (res.apropiado) {
          this.advance();
        } else {
          this.toast.error('No podemos incluir este tipo de palabras en el título o descripción al publicar un vehículo');
        }
      },
      error: (err) => {
        this.uploading.set(false);
        if (err.status === 403 || err.status === 401) {
          this.toast.error('Error de permisos en la moderación. Contacta con soporte.');
        } else {
          this.advance();
        }
      }
    });
  }

  private handleValidationErrors(s: number): void {
    // Feedback específico según el paso
    const currentForm = this.getCurrentForm();
    if (currentForm) {
      currentForm.markAllAsTouched();
      this.toast.warning('Revisa los campos marcados en rojo');
      this.scrollToFirstError();
    } else if (s === 1 && this.step1Form.invalid) {
      this.step1Form.markAllAsTouched();
      this.toast.warning('Selecciona el tipo de vehículo para continuar');
      document.querySelector('.step-0-grid')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (s === 4 && this.images().length === 0) {
      this.toast.warning('Sube al menos una imagen del vehículo');
      // Scroll al área de imágenes
      document.querySelector('.upload-zone')?.scrollIntoView({ behavior: 'smooth' });
    }
  }

  private getCurrentForm() {
    if (this.currentStep() === 2) return this.step2Form;
    if (this.currentStep() === 3) return this.step3Form;
    if (this.currentStep() === 4) return this.step4Form;
    return null;
  }

  prevStep() {
    if (this.currentStep() > 1) {
      this.currentStep.update(s => (s - 1) as PublishStep);
      window.scrollTo(0, 0);
    }
  }

  canAdvance(): boolean {
    const s = this.currentStep();
    if (s === 1) return this.step1Form.valid;
    if (s === 2) return this.step2Form.valid;
    if (s === 3) return this.step3Form.valid;
    if (s === 4) return this.step4Form.valid && this.images().length > 0;
    return true;
  }

  onFileSelected(event: any): void {
    const files: FileList = event.target.files;
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

  removeImage(i: number): void {
    this.images.update((imgs) => {
      const filtered = imgs.filter((_, idx) => idx !== i);
      filtered.forEach((img, idx) => (img.isPrincipal = idx === 0));
      return filtered;
    });
  }

  // ── VISUAL COMPOSER (Rich Text Editor) ───────────────────────────────
  execEditorCommand(command: string, value: string = ''): void {
    document.execCommand(command, false, value);
    this.syncDescription();
    // Re-enfocar el editor después del comando
    this.visualEditor?.nativeElement.focus();
  }

  syncDescription(): void {
    if (this.visualEditor) {
      const content = this.visualEditor.nativeElement.innerHTML;
      const text = this.visualEditor.nativeElement.innerText;
      
      this.step4Form.get('descripcion')?.setValue(content, { emitEvent: true });
      this.updateCounters(text);
    }
  }

  onEditorBlur(): void {
    this.syncDescription();
  }

  private updateCounters(text: string): void {
    this.descriptionCharCount.set(text.length);
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    this.descriptionWordCount.set(words.length);
  }

  applyTemplate(templateContent: string): void {
    if (this.visualEditor) {
      this.visualEditor.nativeElement.innerHTML = templateContent;
      this.syncDescription();
    }
  }

  // ── DESCRIPCIÓN Y PEGADO DE IMÁGENES ───────────────────────────────

  @HostListener('window:paste', ['$event'])
  onPaste(event: ClipboardEvent): void {
    if (this.currentStep() !== 4) return;
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
        if (this.images().length + files.length > 10) {
            this.toast.warning('Máximo 10 fotos por vehículo');
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

  async onSubmit() {
    if (this.uploading()) return;

    if (!this.canAdvance()) {
      const currentForm = this.getCurrentForm();
      currentForm?.markAllAsTouched();
      this.toast.warning('Por favor, completa todos los campos requeridos');
      this.scrollToFirstError();
      return;
    }

    const uid = this.authStore.user()?.id;
    if (!uid) return;

    this.uploading.set(true);
    const formData = new FormData();
    const s1 = this.step1Form.value;
    const s2 = this.step2Form.value;
    const s3 = this.step3Form.value;
    const s4 = this.step4Form.value;

    const vehiculoData = {
      titulo: s4.titulo,
      descripcion: s4.descripcion,
      precio: this.parsePrice(s3.precio),
      tipoOferta: s3.tipoOferta,
      tipoVehiculo: s1.tipoVehiculo,
      condicion: s3.condicion,
      marca: s2.marca,
      modelo: s2.modelo,
      anio: s2.anio,
      kilometros: s2.kilometros,
      combustible: s2.combustible,
      cambio: s2.cambio,
      potencia: s2.potencia,
      cilindrada: s2.cilindrada,
      color: s2.color,
      numeroPuertas: s2.numeroPuertas || (s1.tipoVehiculo === 'COCHE' ? 5 : 0),
      plazas: s2.plazas,
      matricula: s3.matricula,
      itv: s2.itv,
      garantia: s2.garantia,
      ubicacion: s3.ubicacion,
      estadoVehiculo: 'DISPONIBLE'
    };

    formData.append('vehiculo', new Blob([JSON.stringify(vehiculoData)], { type: 'application/json' }));
    const principal = this.images().find(img => img.isPrincipal) || this.images()[0];
    if (principal?.file) formData.append('imagenPrincipal', principal.file);
    this.images().filter(img => !img.isPrincipal && img.file).forEach(img => {
      formData.append('galeria', img.file!);
    });

    const obs$ = this.isEditMode()
      ? this.http.put(`${environment.apiUrl}/vehiculo/${this.vehiculoId()}`, formData)
      : this.http.post(`${environment.apiUrl}/vehiculo/publicar/${uid}`, formData);

    obs$.subscribe({
      next: (res: any) => this.router.navigate(['/vehiculos', res.id]),
      error: () => {
        this.uploading.set(false);
        this.toast.error('Error al publicar. Revisa los datos.');
      }
    });
  }

  getFlagEmoji(country: string): string {
    if (!country) return '🌐';
    const map: { [key: string]: string } = {
      'Francia': '🇫🇷',
      'Alemania': '🇩🇪',
      'España': '🇪🇸',
      'Italia': '🇮🇹',
      'Japón': '🇯🇵',
      'Corea del Sur': '🇰🇷',
      'Reino Unido': '🇬🇧',
      'Estados Unidos': '🇺🇸',
      'China': '🇨🇳',
      'Suecia': '🇸🇪',
      'República Checa': '🇨🇿',
      'Rumanía': '🇷🇴',
      'Países Bajos': '🇳🇱',
      'India': '🇮🇳'
    };
    const c = country.split('/')[0].trim();
    return map[c] || '🌐';
  }
}
