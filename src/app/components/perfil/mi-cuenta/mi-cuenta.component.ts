import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { AuthStore } from '../../../core/auth/auth-store';
import { AuthService } from '../../../core/auth/auth.service';
import { environment } from '../../../../environments/environment';
import { CurrencyEsPipe } from '../../../shared/pipes/currency-es.pipe';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { ViewChild } from '@angular/core';

import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { CoverImagePipe } from '../../../shared/pipes/cover-image.pipe';
import { ProductoCardComponent } from '../../../shared/components/marketplace/product-card/producto-card.component';
import { MisComprasComponent } from '../../compras/mis-compras/mis-compras.component';
import { ConversacionesListComponent } from '../../mensajes/conversaciones-list/conversaciones-list';
import { PagosComponent } from '../pagos/pagos.component';
import { ConfiguracionComponent } from '../configuracion/configuracion.component';
import { VehiculoCardComponent } from '../../../shared/components/vehiculo-card/vehiculo-card.component';
import { FavoritoService } from '../../../core/services/favorito.service';
import { SlugPipe } from '../../../shared/pipes/slug-pipe';
import { createFriendlySlug } from '../../../shared/utils/slug-utils';

type SidebarSection =
  | 'resumen'
  | 'productos'
  | 'ofertas'
  | 'compras'
  | 'ventas'
  | 'publicidad'
  | 'vehiculos'
  | 'buzon'
  | 'favoritos'
  | 'estadisticas'
  | 'pagos'
  | 'configuracion'
  | 'ayuda';

@Component({
  selector: 'app-mi-cuenta',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    CurrencyEsPipe,
    CoverImagePipe,
    ProductoCardComponent,
    MisComprasComponent,
    ConversacionesListComponent,
    PagosComponent,
    ConfirmModalComponent,
    ConfiguracionComponent,
    AvatarComponent,
    VehiculoCardComponent,
    SlugPipe,
  ],
  templateUrl: './mi-cuenta.component.html',
  styleUrls: ['./mi-cuenta.component.css'],
})
export class MiCuentaComponent implements OnInit {
  authStore = inject(AuthStore);
  authService = inject(AuthService);
  private http = inject(HttpClient);
  public router = inject(Router);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);
  private favoritoService = inject(FavoritoService);
  private location = inject(Location);

  @ViewChild('confirmDeleteModal') confirmDeleteModal!: any;
  @ViewChild('logoutModal') logoutModal!: ConfirmModalComponent;
  @ViewChild('confirmStatusModal') confirmStatusModal!: any;

  idToDelete: number | null = null;
  typeToDelete: 'producto' | 'oferta' | 'vehiculo' | null = null;

  statusToChange = signal<{ id: number; status: string; type: 'producto' | 'oferta' | 'vehiculo' } | null>(null);
  modalStatusConfig = signal<{
    title: string;
    message: string;
    confirmText: string;
    type: 'primary' | 'danger' | 'warning' | 'success';
    icon: string;
  }>({
    title: '',
    message: '',
    confirmText: '',
    type: 'primary',
    icon: '',
  });

  // Sidebar
  activeSection = signal<SidebarSection>('resumen');
  mobileMenuOpen = signal(false);
  isMobileUI = signal(window.innerWidth <= 768);

  // Resumen KPIs
  kpis = signal<any>({
    tasaRespuesta: 0,
    ventas: 0,
    compras: 0,
    valoracionMedia: 0,
    totalEnvios: 0
  });

  // Mobile Profile Specific
  selectedCosasType = signal<'productos' | 'ofertas' | 'vehiculos'>('productos');
  activeMobileTab = signal<'cosas' | 'valoraciones' | 'info'>('cosas');
  isEditingProfile = signal(false);
  isConfigOpen = signal(false);
  isMisComprasOpen = signal(false);
  misComprasInitialTab = signal<'COMPRAS' | 'VENTAS'>('COMPRAS');
  valoraciones = signal<any[]>([]);
  cargandoValoraciones = signal(false);
  editForm = signal({
    nombre: '',
    apellidos: '',
    biografia: '',
    ubicacion: '',
    telefono: ''
  });

  // Long-press Actions
  selectedItemForMenu = signal<any | null>(null);
  selectedItemType = signal<'producto' | 'oferta' | 'vehiculo' | null>(null);
  showActionSheet = signal(false);
  longPressTimer: any;

  constructor() {
    window.addEventListener('resize', () => {
      this.isMobileUI.set(window.innerWidth <= 768);
    });
  }

  // Deep linking helper
  targetId = signal<number | null>(null);

  // Mis Productos
  misProductos = signal<any[]>([]);
  productoTab = signal<string>('DISPONIBLE');
  cargandoProductos = signal(false);

  // Mis Ofertas
  misOfertas = signal<any[]>([]);
  ofertaTab = signal<string>('ACTIVA');
  cargandoOfertas = signal(false);

  // Mis Vehiculos
  misVehiculos = signal<any[]>([]);
  vehiculoTab = signal<string>('DISPONIBLE');
  cargandoVehiculos = signal(false);

  // Favoritos
  favProductos = signal<any[]>([]);
  favOfertas = signal<any[]>([]);
  favVehiculos = signal<any[]>([]);
  favTab = signal<'productos' | 'ofertas' | 'vehiculos'>('productos');
  cargandoFavs = signal(false);

  // Ayuda FAQs
  faqs = [
    {
      q: '¿Cómo publico un producto de forma efectiva?',
      a: 'Haz clic en el botón "Publicar" en la cabecera. Te recomendamos usar fotos con luz natural, una descripción detallada y etiquetas relevantes para que los algoritmos de Nexus te posicionen mejor.',
    },
    {
      q: '¿Qué es el Sistema de Protección Nexus?',
      a: 'Es nuestro escudo de seguridad que retiene el pago hasta que el comprador confirma que el producto es correcto. Si hay algún problema, nuestro equipo de soporte intervendrá para mediar.',
    },
    {
      q: '¿Quién se hace cargo de los gastos de envío?',
      a: 'Por defecto, los gastos de envío los asume el comprador, a menos que el vendedor decida ofrecer "Envío Gratuito" como promoción especial en su anuncio.',
    },
    {
      q: '¿Cuándo recibiré el dinero de mi venta?',
      a: 'Una vez que el comprador recibe el paquete y confirma que todo está correcto (o pasan 48h desde la entrega sin disputas), el saldo se liberará en tu Monedero Nexus y podrás transferirlo a tu banco.',
    },
    {
      q: '¿Cómo puedo verificar mi perfil para ganar confianza?',
      a: 'Puedes verificar tu identidad en la sección de Configuración > Seguridad. Un perfil verificado con el sello azul genera hasta un 40% más de ventas.',
    },
    {
      q: '¿Qué hago si recibo un producto que no coincide?',
      a: 'No confirmes la recepción. Abre una disputa desde el chat del pedido adjuntando fotos del problema. Nuestro equipo revisará el caso en menos de 24 horas.',
    },
    {
      q: '¿Puedo cancelar una venta ya aceptada?',
      a: 'Sí, pero te recomendamos hacerlo solo en casos excepcionales. Las cancelaciones frecuentes pueden afectar negativamente a tu valoración de vendedor.',
    },
    {
      q: '¿Cómo funcionan los destacados de Nexus?',
      a: 'Puedes potenciar tus anuncios para que aparezcan en las primeras posiciones de búsqueda y en el feed principal. Consulta los planes disponibles al editar tu producto.',
    },
    {
      q: '¿Cómo cambio mi cuenta a nivel Profesional/Empresa?',
      a: 'Ve a Configuración > Tipo de Cuenta. La cuenta de empresa te permite subir stock ilimitado, acceder a analíticas avanzadas y emitir facturas legales.',
    },
    {
      q: '¿Nexus cobra comisiones por cada venta?',
      a: 'Somos transparentes: Nexus solo cobra una pequeña comisión de gestión para mantener la plataforma y el sistema de pagos seguros. No hay cuotas mensuales para usuarios particulares.',
    },
  ];
  faqOpen = signal<number>(-1);

  // Modal
  showLogoutModal = signal(false);
  showDeleteModal = signal(false);

  // Computed
  user = this.authStore.user;
  hasEnoughData = computed(() => {
    const total = (this.kpis().ventas || 0) + (this.kpis().compras || 0);
    return total >= 3;
  });

  statsByType = computed(() => {
    const ps = this.misProductos();
    const map: any = {};
    ps.forEach((p) => {
      const cat = p.categoria || 'Otros';
      map[cat] = (map[cat] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value: (value as number) }));
  });

  private readonly sidebarBase: { id: SidebarSection; icon: string; label: string }[] = [
    { id: 'resumen', icon: 'fa-user', label: 'Resumen' },
    { id: 'productos', icon: 'fa-box-open', label: 'Mis Productos' },
    { id: 'ofertas', icon: 'fa-tags', label: 'Mis Ofertas' },
    { id: 'vehiculos', icon: 'fa-car', label: 'Mis Vehículos' },
    { id: 'compras', icon: 'fa-shopping-cart', label: 'Mis Compras' },
    { id: 'ventas', icon: 'fa-coins', label: 'Mis Ventas' },
    { id: 'buzon', icon: 'fa-comments', label: 'Buzón' },
    { id: 'favoritos', icon: 'fa-heart', label: 'Favoritos' },
    { id: 'estadisticas', icon: 'fa-chart-bar', label: 'Estadísticas' },
    { id: 'pagos', icon: 'fa-credit-card', label: 'Métodos de Pago' },
    { id: 'configuracion', icon: 'fa-cog', label: 'Configuración' },
    { id: 'ayuda', icon: 'fa-question-circle', label: 'Ayuda' },
  ];

  /** Incluye Publicidad solo para cuentas empresa (después de Mis ventas). */
  sidebarItemsVisible = computed(() => {
    const items = [...this.sidebarBase];
    if (this.authStore.isEmpresa()) {
      const idx = items.findIndex((i) => i.id === 'ventas');
      const row = { id: 'publicidad' as SidebarSection, icon: 'fa-bullhorn', label: 'Publicidad' };
      if (idx >= 0) {
        items.splice(idx + 1, 0, row);
      } else {
        items.push(row);
      }
    }
    return items;
  });

  ngOnInit() {
    this.cargarKPIs();
    if (this.isMobileUI()) {
      this.cargarMisProductos();
      this.cargarMisOfertas();
      this.cargarMisVehiculos();
      this.cargarValoraciones();
    }
    this.route.queryParams.subscribe((params) => {
      const tab = params['tab'];
      if (tab) {
        if (tab === 'publicidad' && !this.authStore.isEmpresa()) {
          this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { tab: 'resumen' },
            replaceUrl: true,
          });
          return;
        }
        this.setSection(tab as SidebarSection);
      }

      const compraId = params['compraId'];
      if (compraId) {
        this.targetId.set(Number(compraId));
      }

      const ofertaId = params['ofertaId'];
      if (ofertaId) {
        this.targetId.set(Number(ofertaId));
        setTimeout(() => this.scrollToHighlight('oferta', Number(ofertaId)), 800);
      }
    });
  }

  scrollToHighlight(prefix: string, id: number) {
    const el = document.getElementById(`${prefix}-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // The pulse is handled by CSS [class.highlight-pulse]
    }
  }

  goBack() {
    this.location.back();
  }

  cargarValoraciones() {
    const u = this.user();
    if (!u) return;
    this.cargandoValoraciones.set(true);
    this.http.get<any[]>(`${environment.apiUrl}/valoracion/vendedor/${u.id}/recibidas`).subscribe({
      next: (res) => {
        this.valoraciones.set(res || []);
        this.cargandoValoraciones.set(false);
      },
      error: () => this.cargandoValoraciones.set(false)
    });
  }

  compartirPerfil() {
    const u = this.user();
    if (!u) return;

    const shareData = {
      title: 'Mi Perfil en Nexus',
      text: `¡Echa un vistazo a mi perfil de Nexus! Tengo artículos increíbles a la venta.`,
      url: window.location.href
    };

    if (navigator.share) {
      navigator.share(shareData)
        .then(() => this.toast.success('¡Gracias por compartir!'))
        .catch((err) => console.log('Error compartiendo:', err));
    } else {
      // Fallback: Copiar al portapapeles
      navigator.clipboard.writeText(window.location.href).then(() => {
        this.toast.info('Enlace copiado al portapapeles');
      });
    }
  }

  openEditProfile() {
    const u = this.user();
    if (!u) return;
    this.editForm.set({
      nombre: u.nombre || '',
      apellidos: u.apellidos || '',
      biografia: u.biografia || '',
      ubicacion: u.ubicacion || '',
      telefono: u.telefono || ''
    });
    this.isEditingProfile.set(true);
  }

  closeEditProfile() {
    this.isEditingProfile.set(false);
  }

  updateEditField(field: string, value: string) {
    this.editForm.update(f => ({ ...f, [field]: value }));
  }

  onAvatarSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const u = this.user();
      if (!u) return;
      const formData = new FormData();
      formData.append('file', file);

      this.http.post<any>(`${environment.apiUrl}/api/usuario/${u.id}/avatar`, formData).subscribe({
        next: () => {
          this.toast.success('Foto actualizada');
          this.authService.loadCurrentUser().subscribe();
        },
        error: () => this.toast.error('Error al subir la imagen')
      });
    }
  }

  guardarCambiosPerfil() {
    const u = this.user();
    if (!u) return;
    this.http.patch(`${environment.apiUrl}/api/usuario/${u.id}`, this.editForm()).subscribe({
      next: () => {
        this.toast.success('Perfil actualizado con éxito');
        this.authService.loadCurrentUser().subscribe();
        this.isEditingProfile.set(false);
      },
      error: () => this.toast.error('No se pudieron guardar los cambios')
    });
  }

  setSection(section: SidebarSection) {
    this.activeSection.set(section);
    this.mobileMenuOpen.set(false);

    switch (section) {
      case 'productos':
        if (this.misProductos().length === 0) this.cargarMisProductos();
        break;
      case 'ofertas':
        if (this.misOfertas().length === 0) this.cargarMisOfertas();
        break;
      case 'vehiculos':
        if (this.misVehiculos().length === 0) this.cargarMisVehiculos();
        break;
      case 'favoritos':
        if (this.favProductos().length === 0) this.cargarFavoritos();
        break;
      case 'configuracion':
        // Ahora usa el componente embebido directamente
        break;
    }
  }

  // ── KPIs ─────────────────────────────────
  cargarKPIs() {
    const u = this.user();
    if (!u) return;
    this.http.get<any>(`${environment.apiUrl}/valoracion/vendedor/${u.id}/resumen`).subscribe({
      next: (res) => {
        this.kpis.update((k) => ({
          ...k,
          valoracionMedia: res.media || 0,
          ventas: u.totalVentas || 0,
          compras: res.totalCompras || 0,
          tasaRespuesta: res.tasaRespuesta || 100,
          totalEnvios: res.totalEnvios || 0
        }));
      },
    });
  }

  // ── Mis Productos ────────────────────────
  cargarMisProductos() {
    const u = this.user();
    if (!u) return;
    this.cargandoProductos.set(true);
    this.http
      .get<any>(`${environment.apiUrl}/producto/filtrar?vendedorId=${u.id}&tamano=50`)
      .subscribe({
        next: (res) => {
          const lista = res?.contenido ?? res?.content ?? res ?? [];
          this.misProductos.set(Array.isArray(lista) ? lista : []);
          this.cargandoProductos.set(false);
        },
        error: () => this.cargandoProductos.set(false),
      });
  }

  productosFiltrados() {
    return this.misProductos().filter((p) => p.estado === this.productoTab());
  }

  public renovarProducto(productoId: number) {
    const u = this.user();
    if (!u) return;
    this.http
      .post(`${environment.apiUrl}/producto/${productoId}/renovar?vendedorId=${u.id}`, {})
      .subscribe({
        next: () => {
          this.misProductos.update((ps) =>
            ps.map((p) =>
              p.id === productoId
                ? { ...p, estado: 'DISPONIBLE', ultimoAvisoCaducidadDias: null }
                : p,
            ),
          );
          this.toast.success('Anuncio reactivado. Vuelve a estar visible.');
        },
        error: () => this.toast.error('No se pudo reactivar el anuncio'),
      });
  }

  cambiarEstadoProducto(productoId: number, nuevoEstado: string) {
    this.http
      .patch(`${environment.apiUrl}/producto/${productoId}/estado`, { estado: nuevoEstado })
      .subscribe({
        next: () => {
          this.misProductos.update((ps) =>
            ps.map((p) => (p.id === productoId ? { ...p, estado: nuevoEstado } : p)),
          );
          this.toast.success(`Estado actualizado a ${nuevoEstado}`);
        },
        error: () => this.toast.error('Error al cambiar el estado'),
      });
  }

  confirmStatusChange(productoId: number, nuevoEstado: string) {
    this.statusToChange.set({ id: productoId, status: nuevoEstado, type: 'producto' });

    let config: any = {
      title: 'Confirmar cambio',
      message: '¿Estás seguro de cambiar el estado de este producto?',
      confirmText: 'Confirmar',
      type: 'primary',
      icon: 'fas fa-exchange-alt',
    };

    if (nuevoEstado === 'VENDIDO') {
      config = {
        title: '¡Producto Vendido!',
        message: '¿Confirmas que has vendido este producto? Pasará a tu historial de ventas.',
        confirmText: 'Sí, vendido',
        type: 'success',
        icon: 'fas fa-check-circle',
      };
    } else if (nuevoEstado === 'RESERVADO') {
      config = {
        title: 'Reservar Producto',
        message: 'El producto se marcará como reservado y no aparecerá en las búsquedas.',
        confirmText: 'Reservar ahora',
        type: 'warning',
        icon: 'fas fa-bookmark',
      };
    } else if (nuevoEstado === 'PAUSADO') {
      config = {
        title: 'Pausar Anuncio',
        message: 'Tu anuncio dejará de ser visible temporalmente. Puedes reactivarlo cuando quieras.',
        confirmText: 'Pausar',
        type: 'danger',
        icon: 'fas fa-eye-slash',
      };
    } else if (nuevoEstado === 'DISPONIBLE') {
      config = {
        title: 'Reactivar Anuncio',
        message: '¡Genial! Tu producto volverá a estar visible para todos los compradores.',
        confirmText: 'Reactivar',
        type: 'success',
        icon: 'fas fa-play',
      };
    }

    this.modalStatusConfig.set(config);
    this.confirmStatusModal.open();
  }

  confirmOfferStatusChange(ofertaId: number, nuevoEstado: string) {
    this.statusToChange.set({ id: ofertaId, status: nuevoEstado, type: 'oferta' });

    let config: any = {
      title: 'Confirmar cambio',
      message: '¿Estás seguro de cambiar el estado de esta oferta?',
      confirmText: 'Confirmar',
      type: 'primary',
      icon: 'fas fa-exchange-alt',
    };

    if (nuevoEstado === 'AGOTADA') {
      config = {
        title: 'Oferta Agotada',
        message: '¿La oferta ya no es válida o se ha agotado el stock? Marcarla como agotada informará a otros usuarios.',
        confirmText: 'Sí, agotada',
        type: 'danger',
        icon: 'fas fa-fire-extinguisher',
      };
    } else if (nuevoEstado === 'PAUSADA') {
      config = {
        title: 'Pausar Oferta',
        message: 'La oferta se ocultará temporalmente. Podrás reactivarla más tarde.',
        confirmText: 'Pausar',
        type: 'warning',
        icon: 'fas fa-pause-circle',
      };
    } else if (nuevoEstado === 'ACTIVA') {
      config = {
        title: 'Reactivar Oferta',
        message: 'La oferta volverá a ser visible para toda la comunidad.',
        confirmText: 'Reactivar',
        type: 'success',
        icon: 'fas fa-bolt',
      };
    }

    this.modalStatusConfig.set(config);
    this.confirmStatusModal.open();
  }

  proceedStatusChange() {
    const data = this.statusToChange();
    if (!data) return;

    if (data.type === 'producto') {
      this.cambiarEstadoProducto(data.id, data.status);
    } else if (data.type === 'oferta') {
      this.cambiarEstadoOferta(data.id, data.status);
    } else if (data.type === 'vehiculo') {
      this.cambiarEstadoVehiculo(data.id, data.status);
    }
  }

  cambiarEstadoOferta(ofertaId: number, nuevoEstado: string) {
    this.http
      .patch(`${environment.apiUrl}/oferta/${ofertaId}/estado`, { estado: nuevoEstado })
      .subscribe({
        next: () => {
          this.misOfertas.update((os) =>
            os.map((o) => (o.id === ofertaId ? { ...o, estado: nuevoEstado } : o)),
          );
          this.toast.success(`Oferta actualizada a ${nuevoEstado}`);
        },
        error: () => this.toast.error('Error al cambiar el estado de la oferta'),
      });
  }

  ofertasFiltradas() {
    return this.misOfertas().filter((o) => o.estado === this.ofertaTab());
  }

  eliminarProducto(productoId: number) {
    this.idToDelete = productoId;
    this.typeToDelete = 'producto';
    this.confirmDeleteModal.open();
  }

  editarProducto(productoId: number) {
    this.router.navigate(['/publicar/editar', productoId]);
  }

  // ── Mis Vehículos ────────────────────────
  cargarMisVehiculos() {
    const u = this.user();
    if (!u) return;
    this.cargandoVehiculos.set(true);
    this.http.get<any[]>(`${environment.apiUrl}/vehiculo/usuario/${u.id}`).subscribe({
      next: (res) => {
        this.misVehiculos.set(res || []);
        this.cargandoVehiculos.set(false);
      },
      error: () => this.cargandoVehiculos.set(false)
    });
  }

  eliminarVehiculo(id: number) {
    this.idToDelete = id;
    this.typeToDelete = 'vehiculo';
    this.confirmDeleteModal.open();
  }

  editarVehiculo(id: number) {
    this.router.navigate(['/publicar/vehiculo/editar', id]);
  }

  vehiculosFiltrados() {
    return this.misVehiculos().filter((v) => v.estadoVehiculo === this.vehiculoTab());
  }

  public renovarVehiculo(vehiculoId: number) {
    const u = this.user();
    if (!u) return;
    this.http
      .post(`${environment.apiUrl}/vehiculo/${vehiculoId}/renovar?publicadorId=${u.id}`, {})
      .subscribe({
        next: () => {
          this.misVehiculos.update((vs) =>
            vs.map((v) =>
              v.id === vehiculoId
                ? { ...v, estadoVehiculo: 'DISPONIBLE', ultimoAvisoCaducidadDias: null }
                : v,
            ),
          );
          this.toast.success('Anuncio de vehículo reactivado.');
        },
        error: () => this.toast.error('No se pudo reactivar el vehículo'),
      });
  }

  confirmVehicleStatusChange(id: number, nuevoEstado: string) {
    this.statusToChange.set({ id, status: nuevoEstado, type: 'vehiculo' });

    let config: any = {
      title: 'Confirmar cambio',
      message: '¿Estás seguro de cambiar el estado de este vehículo?',
      confirmText: 'Confirmar',
      type: 'primary',
      icon: 'fas fa-exchange-alt',
    };

    if (nuevoEstado === 'VENDIDO') {
      config = {
        title: '¡Vehículo Vendido!',
        message: '¿Confirmas que has vendido este vehículo? Pasará a tu historial de ventas.',
        confirmText: 'Sí, vendido',
        type: 'success',
        icon: 'fas fa-check-circle',
      };
    } else if (nuevoEstado === 'RESERVADO') {
      config = {
        title: 'Reservar Vehículo',
        message: 'El vehículo se marcará como reservado y no aparecerá en las búsquedas.',
        confirmText: 'Reservar ahora',
        type: 'warning',
        icon: 'fas fa-bookmark',
      };
    } else if (nuevoEstado === 'PAUSADO') {
      config = {
        title: 'Pausar Anuncio',
        message: 'Tu anuncio dejará de ser visible temporalmente. Puedes reactivarlo cuando quieras.',
        confirmText: 'Pausar',
        type: 'danger',
        icon: 'fas fa-eye-slash',
      };
    } else if (nuevoEstado === 'DISPONIBLE') {
      config = {
        title: 'Reactivar Anuncio',
        message: '¡Genial! Tu vehículo volverá a estar visible para todos los compradores.',
        confirmText: 'Reactivar',
        type: 'success',
        icon: 'fas fa-play',
      };
    }

    this.modalStatusConfig.set(config);
    this.confirmStatusModal.open();
  }

  cambiarEstadoVehiculo(id: number, nuevoEstado: string) {
    this.http
      .patch(`${environment.apiUrl}/vehiculo/${id}/estado`, { estado: nuevoEstado })
      .subscribe({
        next: () => {
          this.misVehiculos.update((vs) =>
            vs.map((v) => (v.id === id ? { ...v, estadoVehiculo: nuevoEstado } : v)),
          );
          this.toast.success(`Estado actualizado a ${nuevoEstado}`);
        },
        error: () => this.toast.error('Error al cambiar el estado del vehículo'),
      });
  }

  confirmAction() {
    if (!this.idToDelete || !this.typeToDelete) return;

    const url = this.typeToDelete === 'producto' 
      ? `${environment.apiUrl}/producto/${this.idToDelete}`
      : `${environment.apiUrl}/oferta/${this.idToDelete}`;

    this.http.delete(url).subscribe({
      next: () => {
        if (this.typeToDelete === 'producto') {
          this.misProductos.update((ps) => ps.filter((p) => p.id !== this.idToDelete));
          this.toast.success('Producto eliminado');
        } else if (this.typeToDelete === 'oferta') {
          this.misOfertas.update((os) => os.filter((o) => o.id !== this.idToDelete));
          this.toast.success('Oferta eliminada');
        } else {
          this.misVehiculos.update((vs) => vs.filter((v) => v.id !== this.idToDelete));
          this.toast.success('Vehículo eliminado');
        }
        this.idToDelete = null;
        this.typeToDelete = null;
      },
      error: () => this.toast.error('Error al eliminar')
    });
  }

  // ── Mis Ofertas ──────────────────────────
  cargarMisOfertas() {
    const u = this.user();
    if (!u) return;
    this.cargandoOfertas.set(true);
    this.http
      .get<any>(`${environment.apiUrl}/oferta/filtrar?vendedorId=${u.id}&tamano=50`)
      .subscribe({
        next: (res) => {
          const lista = res?.contenido ?? res?.content ?? res ?? [];
          this.misOfertas.set(Array.isArray(lista) ? lista : []);
          this.cargandoOfertas.set(false);
        },
        error: () => {
          this.misOfertas.set([]);
          this.cargandoOfertas.set(false);
        },
      });
  }

  eliminarOferta(ofertaId: number) {
    this.idToDelete = ofertaId;
    this.typeToDelete = 'oferta';
    this.confirmDeleteModal.open();
  }

  // ── Favoritos ────────────────────────────
  cargarFavoritos() {
    this.cargandoFavs.set(true);
    const u = this.authStore.user();
    if (!u) return;
    this.http
      .get<any[]>(`${environment.apiUrl}/api/favoritos/usuario/${u.id}`, { withCredentials: true })
      .subscribe({
        next: (data) => {
          this.favProductos.set((data || []).filter((f: any) => f.producto));
          this.favOfertas.set((data || []).filter((f: any) => f.oferta));
          this.favVehiculos.set((data || []).filter((f: any) => f.vehiculo));
          this.cargandoFavs.set(false);
        },
        error: () => {
          this.favProductos.set([]);
          this.favOfertas.set([]);
          this.favVehiculos.set([]);
          this.cargandoFavs.set(false);
        },
      });
  }

  quitarFavorito(favId: number) {
    // Determinamos el tipo para la API
    let type: 'producto' | 'oferta' | 'vehiculo' = 'producto';
    if (this.favTab() === 'ofertas') type = 'oferta';
    if (this.favTab() === 'vehiculos') type = 'vehiculo';

    // Obtenemos el ID real del item (producto.id, vehiculo.id o oferta.id)
    const fav = [...this.favProductos(), ...this.favOfertas(), ...this.favVehiculos()].find(f => f.id === favId);
    const itemId = fav?.producto?.id || fav?.vehiculo?.id || fav?.oferta?.id;

    if (!itemId) return;

    this.favoritoService.removeFavorito(itemId, type).subscribe({
      next: () => {
        this.favProductos.update((fs) => fs.filter((f) => f.id !== favId));
        this.favOfertas.update((fs) => fs.filter((f) => f.id !== favId));
        this.favVehiculos.update((fs) => fs.filter((f) => f.id !== favId));
      },
    });
  }

  // ── FAQs ─────────────────────────────────
  toggleFaq(index: number) {
    this.faqOpen.set(this.faqOpen() === index ? -1 : index);
  }

  confirmarLogout() {
    this.logoutModal.open();
  }

  logout() {
    this.showLogoutModal.set(false);
    this.authService.logout();
  }

  // ── Helpers ──────────────────────────────
  getStarsArray(rating: number): boolean[] {
    return [1, 2, 3, 4, 5].map((n) => n <= Math.round(rating));
  }

  getEstadoColor(estado: string): string {
    switch (estado) {
      case 'DISPONIBLE':
      case 'ACTIVA':
        return '#22c55e';
      case 'RESERVADO':
        return '#f59e0b';
      case 'EXPIRADO':
        return '#dc2626';
      case 'VENDIDO':
      case 'AGOTADA':
      case 'PAUSADO':
      case 'PAUSADA':
        return '#6b7280';
      default:
        return '#9ca3af';
    }
  }

  irAChat(conv: any) {
    this.router.navigate(['/mensajes']);
  }

  // ── Long-press Handlers ─────────────────
  onPressStart(item: any, type: 'producto' | 'oferta' | 'vehiculo') {
    if (!this.isMobileUI()) return;
    
    // Prevent starting multiple timers
    this.onPressEnd();
    
    this.longPressTimer = setTimeout(() => {
      this.selectedItemForMenu.set(item);
      this.selectedItemType.set(type);
      this.showActionSheet.set(true);
      
      // Haptic feedback if available
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    }, 600); // 600ms long press
  }

  onPressEnd() {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  closeActionSheet() {
    this.showActionSheet.set(false);
    setTimeout(() => {
      this.selectedItemForMenu.set(null);
      this.selectedItemType.set(null);
    }, 300);
  }

  navigateToDetail(item: any, type: 'productos' | 'ofertas' | 'vehiculos') {
    const slug = createFriendlySlug(item.titulo || `${item.marca} ${item.modelo}`, item.id);
    this.router.navigate([`/${type}`, slug]);
  }

  executeMenuAction(action: string) {
    const item = this.selectedItemForMenu();
    const type = this.selectedItemType();
    if (!item || !type) return;

    this.closeActionSheet();

    switch (action) {
      case 'edit':
        if (type === 'producto') this.editarProducto(item.id);
        else if (type === 'oferta') this.router.navigate(['/publicar/oferta/editar', item.id]);
        else if (type === 'vehiculo') this.editarVehiculo(item.id);
        break;
      
      case 'VENDIDO':
      case 'RESERVADO':
      case 'PAUSADO':
      case 'DISPONIBLE':
      case 'ACTIVA':
      case 'AGOTADA':
        if (type === 'producto') this.confirmStatusChange(item.id, action);
        else if (type === 'oferta') this.confirmOfferStatusChange(item.id, action);
        else if (type === 'vehiculo') this.confirmVehicleStatusChange(item.id, action);
        break;

      case 'delete':
        if (type === 'producto') this.eliminarProducto(item.id);
        else if (type === 'oferta') this.eliminarOferta(item.id);
        else if (type === 'vehiculo') this.eliminarVehiculo(item.id);
        break;
    }
  }

  openMisCompras(tab: 'COMPRAS' | 'VENTAS') {
    this.misComprasInitialTab.set(tab);
    this.isMisComprasOpen.set(true);
  }
}
