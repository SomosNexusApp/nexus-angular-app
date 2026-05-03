import { Component, OnInit, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { AuthStore } from '../../../core/auth/auth-store';
import { CurrencyEsPipe } from '../../../shared/pipes/currency-es.pipe';
import { TimeAgoPipe } from '../../../shared/pipes/time-ago.pipe';
import { FormsModule } from '@angular/forms';
import { ReporteModalComponent } from '../../../shared/components/reporte-modal/reporte-modal.component';
import { ToastService } from '../../../core/services/toast.service';
import { ViewChild } from '@angular/core';
import { FavoritoService } from '../../../core/services/favorito.service';
import { UiService } from '../../../core/services/ui.service';
import { extractIdFromSlug, createFriendlySlug } from '../../../shared/utils/slug-utils';

import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';

@Component({
  selector: 'app-vehiculo-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    CurrencyEsPipe,
    TimeAgoPipe,
    FormsModule,
    ReporteModalComponent,
    AvatarComponent,
  ],
  templateUrl: './vehiculo-detail.component.html',
  styleUrls: ['./vehiculo-detail.component.css'],
})
export class VehiculoDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);
  private favoritoService = inject(FavoritoService);
  private location = inject(Location);
  uiService = inject(UiService);
  authStore = inject(AuthStore);
  private toast = inject(ToastService);

  @ViewChild(ReporteModalComponent) reporteModal!: ReporteModalComponent;

  vehiculo = signal<any>(null);
  similares = signal<any[]>([]);
  valoraciones = signal<any[]>([]);
  resumenValoraciones = signal<any>(null);
  cargando = signal(true);
  imgPrincipal = signal<string>('');
  esFavorito = signal(false);

  ngOnInit() {
    window.scrollTo(0, 0);
    this.uiService.isDetailView.set(true);
    
    this.route.params.subscribe((params) => {
      const slug = params['slug'];
      if (slug) {
        const id = extractIdFromSlug(slug);
        if (id) {
          this.cargando.set(true);
          this.vehiculo.set(null);
          this.cargarVehiculo(id);
        }
      }
    });
  }

  ngOnDestroy() {
    this.uiService.isDetailView.set(false);
  }

  goBack() {
    this.location.back();
  }

  private cargarVehiculo(id: string) {
    this.http.get<any>(`${environment.apiUrl}/vehiculo/${id}`).subscribe({
      next: (res) => {
        this.vehiculo.set(res);
        this.imgPrincipal.set(res.imagenPrincipal);
        this.cargando.set(false);
        this.cargarSimilares(res.publicador?.id);
        if (res.publicador?.id) {
          this.cargarValoraciones(res.publicador.id);
          this.cargarResumenValoraciones(res.publicador.id);
        }
        this.verificarFavorito(res.id);
      },
      error: () => this.cargando.set(false),
    });
  }

  private cargarSimilares(actorId?: number) {
    if (!actorId) return;
    this.http.get<any[]>(`${environment.apiUrl}/vehiculo`).subscribe((res) => {
      this.similares.set(
        res.filter((v) => v.id !== this.vehiculo().id && v.publicador?.id === actorId).slice(0, 4),
      );
    });
  }

  private cargarValoraciones(vendedorId: number) {
    this.http.get<any[]>(`${environment.apiUrl}/valoracion/vendedor/${vendedorId}`).subscribe({
      next: (res) => this.valoraciones.set(res),
      error: () => this.valoraciones.set([])
    });
  }

  private cargarResumenValoraciones(vendedorId: number) {
    this.http.get<any>(`${environment.apiUrl}/valoracion/vendedor/${vendedorId}/resumen`).subscribe({
      next: (res) => this.resumenValoraciones.set(res),
      error: () => this.resumenValoraciones.set(null)
    });
  }

  contactar() {
    if (!this.authStore.isLoggedIn()) {
      this.toast.error('Inicia sesión para contactar');
      return;
    }
    this.router.navigate(['/mensajes'], { queryParams: { productoId: this.vehiculo()?.id } });
  }

  abrirReporte() {
    if (!this.authStore.isLoggedIn()) {
      this.toast.warning('Inicia sesión para reportar.');
      return;
    }
    this.reporteModal.abrir('VEHICULO', this.vehiculo().id);
  }

  verificarFavorito(vehiculoId: number) {
    if (!this.authStore.isLoggedIn()) return;
    this.favoritoService.getFavoritosIds().subscribe({
      next: (ids) => this.esFavorito.set(ids.includes(`vehiculo_${vehiculoId}`))
    });
  }

  toggleFavorito() {
    if (!this.authStore.isLoggedIn()) {
      this.toast.warning('Inicia sesión para guardar en favoritos');
      return;
    }
    const id = this.vehiculo().id;
    const isFav = this.esFavorito();
    this.esFavorito.set(!isFav);

    if (!isFav) {
      this.favoritoService.addFavorito(id, 'vehiculo').subscribe({
        error: () => this.esFavorito.set(isFav)
      });
    } else {
      this.favoritoService.removeFavorito(id, 'vehiculo').subscribe({
        error: () => this.esFavorito.set(isFav)
      });
    }
  }

  compartir() {
    if (navigator.share) {
      navigator.share({
        title: this.vehiculo()?.titulo,
        text: `Mira este vehículo en Nexus: ${this.vehiculo()?.titulo}`,
        url: window.location.href
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      this.toast.success('Enlace copiado al portapapeles');
    }
  }

  irAVehiculoSimilar(v: any) {
    const slug = createFriendlySlug(`${v.marca} ${v.modelo}`, v.id);
    this.router.navigate(['/vehiculos', slug]);
  }
}

