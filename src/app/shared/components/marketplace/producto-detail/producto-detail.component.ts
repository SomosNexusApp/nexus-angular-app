import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { TimeAgoPipe } from '../../../pipes/time-ago.pipe';
import { CurrencyEsPipe } from '../../../pipes/currency-es.pipe';
import { ProductoCardComponent } from '../product-card/producto-card.component';
import { Producto } from '../../../../models/producto.model';
import { Valoracion } from '../../../../models/valoracion.model';
import { Usuario } from '../../../../models/usuario.model';
import { environment } from '../../../../../environments/environment';
import { AuthStore } from '../../../../core/auth/auth-store';
import { FavoritoService } from '../../../../core/services/favorito.service';
import { ChatService } from '../../../../core/services/chat.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ReporteModalComponent } from '../../reporte-modal/reporte-modal.component';
import { GuestPopupService } from '../../../../core/services/guest-popup.service';
import { UiService } from '../../../../core/services/ui.service';

@Component({
  selector: 'app-producto-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    TimeAgoPipe,
    CurrencyEsPipe,
    ProductoCardComponent,
    ReporteModalComponent
  ],
  templateUrl: './producto-detail.component.html',
  styleUrls: ['./producto-detail.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductoDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  router = inject(Router);
  private http = inject(HttpClient);
  private authStore = inject(AuthStore);
  private favoritoService = inject(FavoritoService);
  private chatService = inject(ChatService);
  private toast = inject(ToastService);
  private guestPopupService = inject(GuestPopupService);
  uiService = inject(UiService);

  // ── Estado principal ────────────────────────────────────────────────
  producto = signal<Producto | null>(null);
  precioNegociado = signal<number | null>(null);
  cargando = signal(true);
  error = signal<string | null>(null);

  @ViewChild(ReporteModalComponent) reporteModal!: ReporteModalComponent;

  // ── Galería ──────────────────────────────────────────────────────────
  imagenActivaIdx = signal(0);
  zoomActivo = signal(false);

  // ── Vendedor ─────────────────────────────────────────────────────────
  vendedor = signal<Usuario | null>(null);
  valoraciones = signal<Valoracion[]>([]);
  productosVendedor = signal<Producto[]>([]);
  cargandoVendedor = signal(false);

  // ── Productos relacionados ────────────────────────────────────────────
  relacionados = signal<Producto[]>([]);

  // ── Auth state (desde AuthStore) ─────────────────────────────────────
  isLoggedIn = this.authStore.isLoggedIn;
  currentUserId = computed(() => this.authStore.user()?.id ?? null);
  esFavorito = signal(false);

  // ── Modales ──────────────────────────────────────────────────────────
  modalOfertaAbierto = signal(false);
  modalBorrarAbierto = signal(false);
  precioOfertaInput = signal<number | null>(null);
  minPrecioPermitido = signal<number>(0);

  // ── Descripción expandida ─────────────────────────────────────────────
  descExpandida = signal(false);

  // ── Computed ──────────────────────────────────────────────────────────
  todasImagenes = computed(() => {
    const p = this.producto();
    if (!p) return [];
    const imgs: string[] = [];
    if (p.imagenPrincipal) imgs.push(p.imagenPrincipal);
    if (p.galeriaImagenes?.length) imgs.push(...p.galeriaImagenes);
    return imgs.length > 0
      ? imgs
      : ['https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=800&auto=format&fit=crop'];
  });

  imagenActiva = computed(() => this.todasImagenes()[this.imagenActivaIdx()]);

  esVendedorPropietario = computed(() => {
    const p = this.producto();
    const userId = this.currentUserId();
    if (!p || !userId) return false;
    return (p.vendedor as any)?.id === userId;
  });

  puedeComprar = computed(() => {
    const p = this.producto();
    // No se puede comprar si es intercambio, si ya está vendido/reservado, si es el vendedor o si no admite envío
    return (
      p?.estado === 'DISPONIBLE' &&
      p?.tipoOferta === 'VENTA' &&
      this.isLoggedIn() &&
      !this.esVendedorPropietario() &&
      p.admiteEnvio === true
    );
  });

  soloRecogidaPersonal = computed(() => {
    const p = this.producto();
    return !!p && p.admiteEnvio === false && p.estado === 'DISPONIBLE' && p.tipoOferta === 'VENTA';
  });

  mediaEstrellas = computed(() => {
    const vals = this.valoraciones();
    if (!vals.length) return 0;
    return vals.reduce((sum, v) => sum + v.puntuacion, 0) / vals.length;
  });

  starArray = computed(() => {
    const media = this.mediaEstrellas();
    return [1, 2, 3, 4, 5].map((n) => ({
      full: n <= Math.floor(media),
      half: n === Math.ceil(media) && media % 1 >= 0.5,
      empty: n > Math.ceil(media),
    }));
  });

  descLarga = computed(() => (this.producto()?.descripcion?.length ?? 0) > 220);
  esIntercambio = computed(() => this.producto()?.tipoOferta === 'INTERCAMBIO');
  esDonacion = computed(() => this.producto()?.tipoOferta === 'DONACION');

  private routeSub: any;

  ngOnInit(): void {
    window.scrollTo(0, 0);
    this.uiService.isDetailView.set(true);
    this.routeSub = this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) this.cargarProducto(+id);
    });
  }

  ngOnDestroy(): void {
    this.uiService.isDetailView.set(false);
    this.routeSub?.unsubscribe();
  }

  goBack(): void {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      this.router.navigate(['/']);
    }
  }

  compartir(): void {
    const p = this.producto();
    if (!p) return;
    if (navigator.share) {
      navigator.share({
        title: p.titulo,
        text: `Mira este producto en Nexus: ${p.titulo}`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      // Fallback: copiar al portapapeles
      navigator.clipboard.writeText(window.location.href);
      this.toast.info('Enlace copiado al portapapeles');
    }
  }

  // ── Carga de datos ────────────────────────────────────────────────────
  cargarProducto(id: number): void {
    this.cargando.set(true);
    this.error.set(null);
    this.imagenActivaIdx.set(0);

    this.http.get<Producto>(`${environment.apiUrl}/producto/${id}`).subscribe({
      next: (p) => {
        this.producto.set(p);
        this.minPrecioPermitido.set(Math.round(p.precio * 0.8 * 100) / 100);
        this.cargando.set(false);
        this.cargarVendedor(p);
        this.cargarRelacionados(p);
        this.verificarFavorito(p.id);
        this.verificarOfertaAceptada(p.id);
      },
      error: () => {
        this.error.set('No se pudo cargar el producto.');
        this.cargando.set(false);
      },
    });
  }

  private cargarVendedor(p: Producto): void {
    const vendedorId = (p.vendedor as any)?.id;
    if (!vendedorId) return;
    this.cargandoVendedor.set(true);

    this.http.get<Usuario>(`${environment.apiUrl}/api/usuario/${vendedorId}/perfil`).subscribe({
      next: (u) => this.vendedor.set(u),
    });

    this.http
      .get<Valoracion[]>(`${environment.apiUrl}/valoracion/vendedor/${vendedorId}`)
      .subscribe({ next: (v) => this.valoraciones.set(v.slice(0, 3)) });

    this.http
      .get<any>(`${environment.apiUrl}/producto/filtrar?vendedorId=${vendedorId}&tamano=4`)
      .subscribe({
        next: (res) => {
          const lista = res?.contenido ?? res ?? [];
          this.productosVendedor.set(lista.filter((pp: Producto) => pp.id !== p.id));
          this.cargandoVendedor.set(false);
        },
        error: () => this.cargandoVendedor.set(false),
      });
  }

  private cargarRelacionados(p: Producto): void {
    const catSlug = p.categoria?.slug;
    if (!catSlug) return;
    this.http
      .get<any>(`${environment.apiUrl}/producto/filtrar?categoria=${catSlug}&tamano=6`)
      .subscribe({
        next: (res) => {
          const lista = res?.contenido ?? res ?? [];
          this.relacionados.set(lista.filter((pp: Producto) => pp.id !== p.id).slice(0, 6));
        },
      });
  }

  // ── Galería ───────────────────────────────────────────────────────────
  setImagenActiva(idx: number): void {
    this.imagenActivaIdx.set(idx);
  }

  prevImagen(): void {
    const len = this.todasImagenes().length;
    this.imagenActivaIdx.update((i) => (i - 1 + len) % len);
  }

  nextImagen(): void {
    const len = this.todasImagenes().length;
    this.imagenActivaIdx.update((i) => (i + 1) % len);
  }

  // ── Acciones comprador ────────────────────────────────────────────────
  comprarAhora(): void {
    if (!this.isLoggedIn()) {
      // Redirige al flujo de login y vuelve al producto después
      this.router.navigate(['/login'], {
        queryParams: { returnUrl: this.router.url },
      });
      return;
    }
    const id = this.producto()?.id;
    if (!id) return;
    // Verificar estado fresco antes de navegar
    this.http.get<Producto>(`${environment.apiUrl}/producto/${id}`).subscribe({
      next: (p) => {
        if (p.estado === 'DISPONIBLE' && p.tipoOferta !== 'INTERCAMBIO') {
          this.router.navigate(['/checkout', id]);
        } else {
          this.producto.set(p);
          if (p.tipoOferta === 'INTERCAMBIO') this.toast.info('Los productos de intercambio deben negociarse por chat.');
        }
      },
    });
  }

  irAlChat(): void {
    if (!this.isLoggedIn()) {
      this.guestPopupService.showPopup('Para contactar al vendedor');
      return;
    }
    this.router.navigate(['/mensajes'], { queryParams: { productoId: this.producto()?.id } });
  }

  verificarFavorito(productoId: number): void {
    if (!this.isLoggedIn()) return;
    this.favoritoService.getFavoritosIds().subscribe({
      next: (ids: string[]) => this.esFavorito.set(ids.includes(`producto_${productoId}`)),
    });
  }

  toggleFavorito(): void {
    if (!this.isLoggedIn()) {
      this.guestPopupService.showPopup('Para guardar tus productos favoritos');
      return;
    }

    const productoId = this.producto()!.id;
    const esFavActual = this.esFavorito(); // Guardamos el estado previo

    // Optimistic UI: Actualizamos visualmente al instante para que se sienta rápido
    this.esFavorito.set(!esFavActual);

    if (!esFavActual) {
      // Si NO era favorito, lo agregamos
      this.favoritoService.addFavorito(productoId, 'producto').subscribe({
        error: () => this.esFavorito.set(esFavActual), // Revertimos si falla el servidor
      });
    } else {
      // Si YA era favorito, lo eliminamos
      this.favoritoService.removeFavorito(productoId, 'producto').subscribe({
        error: () => this.esFavorito.set(esFavActual), // Revertimos si falla el servidor
      });
    }
  }

  // ── Acciones vendedor ─────────────────────────────────────────────────
  marcarVendido(): void {
    const id = this.producto()?.id;
    if (!id) return;
    this.http
      .patch(`${environment.apiUrl}/producto/${id}/estado`, { estado: 'VENDIDO' })
      .subscribe({
        next: () => this.producto.update((p) => (p ? { ...p, estado: 'VENDIDO' } : p)),
      });
  }

  confirmarEliminar(): void {
    this.modalBorrarAbierto.set(true);
  }

  eliminarProducto(): void {
    const id = this.producto()?.id;
    if (!id) return;
    this.http.delete(`${environment.apiUrl}/producto/${id}`).subscribe({
      next: () => this.router.navigate(['/perfil']),
    });
    this.modalBorrarAbierto.set(false);
  }

  // ── Modal oferta de precio ────────────────────────────────────────────
  abrirModalOferta(): void {
    if (!this.isLoggedIn()) {
      this.guestPopupService.showPopup('Para negociar precios');
      return;
    }
    this.modalOfertaAbierto.set(true);
  }

  enviarOferta(): void {
    const precio = this.precioOfertaInput();
    const p = this.producto();
    const currUser = this.authStore.user();
    if (!precio || !p || !currUser) return;

    const vendedorId = (p.vendedor as any)?.id;
    if (!vendedorId) return;

    this.chatService
      .enviarPropuestaPrecio(p.id, currUser.id, vendedorId, precio)
      .subscribe({
        next: () => {
          this.modalOfertaAbierto.set(false);
          this.irAlChat();
        },
        error: (err) => {
          console.error('Error enviando oferta:', err);
          this.toast.error('No se pudo enviar la oferta. Inténtalo de nuevo.');
        }
      });
  }

  // ── Reporte ───────────────────────────────────────────────────────────
  reportarAnuncio(): void {
    if (!this.isLoggedIn()) {
      this.toast.warning('Inicia sesión para reportar anuncios.');
      return;
    }
    const p = this.producto();
    if (p) {
      this.reporteModal.abrir('PRODUCTO', p.id);
    }
  }

  // ── Helpers UI ────────────────────────────────────────────────────────
  trackByIdx(i: number): number {
    return i;
  }

  getAvatarFallback(nombre?: string): string {
    return nombre ? nombre.charAt(0).toUpperCase() : 'U';
  }

  verificarOfertaAceptada(productoId: number): void {
    const userId = this.currentUserId();
    if (!userId) return;

    this.chatService.getOfertaAceptada(productoId, userId).subscribe({
      next: (res) => {
        if (res && res.precio > 0) {
          this.precioNegociado.set(res.precio);
        } else {
          this.precioNegociado.set(null);
        }
      }
    });
  }

  validarFormatoPrecio(event: any) {
    const input = event.target as HTMLInputElement;
    let value = input.value;
    
    if (value.includes('.')) {
      const [entero, decimal] = value.split('.');
      if (decimal.length > 2) {
        value = entero + '.' + decimal.slice(0, 2);
        input.value = value;
      }
    }
    
    this.precioOfertaInput.set(value === '' ? null : parseFloat(value));
  }
}

