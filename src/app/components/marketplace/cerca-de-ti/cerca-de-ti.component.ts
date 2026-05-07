import { Component, OnInit, signal, inject, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SearchService, SearchParams } from '../../../core/services/search.service';
import { AuthStore } from '../../../core/auth/auth-store';
import { ProductoCardComponent } from '../../../shared/components/marketplace/product-card/producto-card.component';
import { OfertaCardComponent } from '../../../shared/components/marketplace/oferta-card/oferta-card.component';
import { VehiculoCardComponent } from '../../../shared/components/vehiculo-card/vehiculo-card.component';
import { MarketplaceItem } from '../../../models/marketplace-item.model';

@Component({
  selector: 'app-cerca-de-ti',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    ProductoCardComponent, 
    OfertaCardComponent, 
    VehiculoCardComponent
  ],
  templateUrl: './cerca-de-ti.component.html',
  styleUrls: ['./cerca-de-ti.component.css']
})
export class CercaDeTiComponent implements OnInit, OnDestroy {
  private searchService = inject(SearchService);
  private authStore = inject(AuthStore);
  private cdr = inject(ChangeDetectorRef);

  resultados = signal<MarketplaceItem[]>([]);
  loading = signal(true);
  error = signal(false);
  locationDenied = signal(false);

  radius = signal(50); // km por defecto
  userLocation = signal<{lat: number, lng: number} | null>(null);

  skeletons = Array(12).fill(0);

  ngOnInit() {
    this.obtenerUbicacion();
  }

  ngOnDestroy() {}

  obtenerUbicacion() {
    this.loading.set(true);
    this.locationDenied.set(false);
    this.error.set(false);

    if (!navigator.geolocation) {
      this.error.set(true);
      this.loading.set(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        this.userLocation.set(coords);
        this.realizarBusqueda(coords, this.radius());
      },
      (err) => {
        console.error('Error obteniendo ubicación:', err);
        if (err.code === 1 /* PERMISSION_DENIED */) {
          this.locationDenied.set(true);
        } else {
          this.error.set(true);
        }
        this.loading.set(false);
        this.cdr.detectChanges();
      },
      { timeout: 10000 }
    );
  }

  realizarBusqueda(coords: {lat: number, lng: number}, radiusKm: number) {
    this.loading.set(true);
    // Pedimos un margen extra al backend (x2) y luego filtramos exacto con Haversine
    const backendRadius = Math.min(radiusKm * 2, 400);
    const params: SearchParams = {
      tipo: 'TODOS',
      lat: coords.lat,
      lng: coords.lng,
      radius: backendRadius,
      page: 0,
      size: 200
    };

    const usuarioId = this.authStore.user()?.id;

    this.searchService.buscar(params, usuarioId).subscribe({
      next: (res) => {
        // Filtrar con distancia Haversine exacta según el radio seleccionado
        const filtrados = (res.items || []).filter((it: any) => {
          if (it.latitude == null || it.longitude == null) return false;
          const distKm = this.haversineKm(coords.lat, coords.lng, it.latitude, it.longitude);
          return distKm <= radiusKm;
        });
        this.resultados.set(filtrados);
        this.loading.set(false);
        this.cdr.detectChanges();
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
        this.cdr.detectChanges();
      }
    });
  }

  cambiarRadio(nuevoRadio: number) {
    this.radius.set(nuevoRadio);
    const coords = this.userLocation();
    if (coords) {
      this.realizarBusqueda(coords, nuevoRadio);
    }
  }

  /**
   * Fórmula Haversine: distancia en km entre dos puntos geográficos.
   */
  private haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radio de la Tierra en km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
