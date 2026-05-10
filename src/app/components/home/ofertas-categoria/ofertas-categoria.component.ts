import { Component, OnInit, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { OfertaCardComponent } from '../../../shared/components/marketplace/oferta-card/oferta-card.component';
import { AuthStore } from '../../../../app/core/auth/auth-store';
import { MarketplaceItem } from '../../../../app/models/marketplace-item.model';

export interface Categoria {
  id: number;
  nombre: string;
  slug: string;
}

@Component({
  selector: 'app-ofertas-categoria',
  standalone: true,
  imports: [CommonModule, RouterModule, OfertaCardComponent],
  templateUrl: './ofertas-categoria.component.html',
  styleUrls: ['./ofertas-categoria.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfertasCategoriaComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  private authStore = inject(AuthStore);

  categorias = signal<Categoria[]>([]);
  activeSlug = signal<string>('');
  ofertas = signal<MarketplaceItem[]>([]);

  loadingCats = signal(true);
  loadingItems = signal(false);
  errorCats = signal(false);
  errorItems = signal(false);

  private cache = new Map<string, MarketplaceItem[]>();

  readonly skeletonTabs = Array(6).fill(0);
  readonly skeletonCards = Array(3).fill(0); // Show 3 skeletons for a cleaner look

  ngOnInit() {
    this.http.get<any>(`${environment.apiUrl}/categorias/raiz`).subscribe({
      next: (res) => {
        const list = Array.isArray(res) ? res : (res?.content ?? res?.data ?? []);
        // Añadimos una categoría virtual "Flash" al principio
        const flashTab: Categoria = { id: -1, nombre: 'Flash', slug: 'flash' };
        const top = [flashTab, ...list.slice(0, 9)];
        this.categorias.set(top);
        this.loadingCats.set(false);
        if (top.length > 0) this.selectTab(top[0].slug);
      },
      error: () => {
        this.loadingCats.set(false);
        this.errorCats.set(true);
      },
    });
  }

  selectTab(slug: string) {
    if (this.activeSlug() === slug && this.ofertas().length > 0) return;

    this.activeSlug.set(slug);

    if (this.cache.has(slug)) {
      this.ofertas.set(this.cache.get(slug)!);
      this.errorItems.set(false);
      return;
    }

    this.loadingItems.set(true);
    this.errorItems.set(false);
    this.ofertas.set([]); // Clear current offers to show skeletons

    const usuarioId = this.authStore.user()?.id;

    if (slug === 'flash') {
      let url = `${environment.apiUrl}/oferta/flash`;
      if (usuarioId) url += `?usuarioId=${usuarioId}`;

      this.http.get<any>(url).subscribe({
        next: (res) => {
          const list = Array.isArray(res) ? res : (res?.content ?? res?.ofertas ?? res?.data ?? []);
          const items = (list as MarketplaceItem[]).slice(0, 6);
          this.cache.set(slug, items);
          this.ofertas.set(items);
          this.loadingItems.set(false);
        },
        error: () => {
          this.loadingItems.set(false);
          this.errorItems.set(true);
          this.ofertas.set([]);
        },
      });
      return;
    }

    let params = new HttpParams()
      .set('categoria', slug)
      .set('soloActivas', 'true')
      .set('page', '0')
      .set('size', '6');

    if (usuarioId) params = params.set('usuarioId', String(usuarioId));

    this.http.get<any>(`${environment.apiUrl}/oferta/filtrar`, { params }).subscribe({
      next: (res) => {
        // El backend de Nexus devuelve 'contenido' en lugar del estándar 'content' de Spring Data
        const list = Array.isArray(res)
          ? res
          : (res?.contenido ?? res?.content ?? res?.ofertas ?? res?.data ?? []);
        const items = (list as MarketplaceItem[]).slice(0, 6);
        this.cache.set(slug, items);
        this.ofertas.set(items);
        this.loadingItems.set(false);
      },
      error: () => {
        this.loadingItems.set(false);
        this.errorItems.set(true);
        this.ofertas.set([]);
      },
    });
  }

  goToCategory(slug: string) {
    this.router.navigate(['/search'], { queryParams: { categoria: slug, tipo: 'OFERTA' } });
  }
}
