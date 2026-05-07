import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CurrencyEsPipe } from '../../pipes/currency-es.pipe';

import { createFriendlySlug } from '../../utils/slug-utils';

export interface MegaMenuConfig {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  accentColor: string;
  viewAllLink: string;
  viewAllParams?: any;
}

@Component({
  selector: 'app-mega-menu',
  standalone: true,
  imports: [CommonModule, RouterModule, CurrencyEsPipe],
  template: `
    <div class="mega-menu fade-in-up" [style.--accent-color]="config?.accentColor">
      <div class="container menu-content">
        <!-- Header -->
        <div class="menu-header">
          <div class="header-left">
            <i [className]="config?.icon + ' main-icon'"></i>
            <div>
              <h3>{{ config?.title }}</h3>
              <p>{{ config?.subtitle }}</p>
            </div>
          </div>
          <a [routerLink]="config?.viewAllLink" [queryParams]="config?.viewAllParams" class="btn-all" (click)="onItemClick()">
            Ver todo <i class="fas fa-arrow-right"></i>
          </a>
        </div>

        <!-- Grid -->
        <div class="items-grid">
          @if (loading) {
            @for (i of [1,2,3,4]; track i) {
              <div class="item-skeleton">
                <div class="skeleton-img"></div>
                <div class="skeleton-text"></div>
                <div class="skeleton-text short"></div>
              </div>
            }
          } @else {
            @for (item of items; track item.id) {
              <a [routerLink]="getRoute(item)" class="item-card" (click)="onItemClick()">
                <div class="card-image">
                  <img [src]="item.imagenPrincipal || 'assets/images/placeholder.jpg'" [alt]="item.titulo">
                  
                  <!-- Badges based on type/content -->
                  <div class="card-badge" *ngIf="getBadge(item) as badge" [style.background]="badge.color">
                    {{ badge.text }}
                  </div>

                  <div class="price-tag" *ngIf="getPrice(item) as p">
                    <span class="old-price" *ngIf="p.original">{{ p.original | currencyEs }}</span>
                    <span class="new-price">{{ p.current | currencyEs }}</span>
                  </div>
                </div>
                <div class="card-info">
                  <h4 class="item-title">{{ item.titulo }}</h4>
                  <p class="item-meta" *ngIf="getMeta(item) as meta">
                    <i [className]="meta.icon"></i> {{ meta.text }}
                  </p>
                </div>
                <div class="card-glow"></div>
              </a>
            } @empty {
              <div class="empty-state">
                <i class="fas fa-box-open"></i>
                <p>No hay elementos disponibles en esta sección ahora mismo.</p>
              </div>
            }
          }
        </div>

        <!-- Footer (Optional stats) -->
        <div class="menu-footer">
          <div class="footer-stat"><i class="fas fa-shield-halved"></i> Garantía Nexus</div>
          <div class="footer-stat"><i class="fas fa-bolt"></i> Compra Instantánea</div>
          <div class="footer-stat"><i class="fas fa-comments"></i> Soporte Premium</div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .mega-menu {
      position: absolute;
      top: 100%;
      left: 0;
      width: 100%;
      background: rgba(10, 11, 18, 0.96);
      backdrop-filter: blur(20px) saturate(160%);
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      padding: 20px 0;
      z-index: 1000;
      box-shadow: 0 30px 60px rgba(0, 0, 0, 0.5);
    }
    .menu-content { max-width: 1400px; margin: 0 auto; padding: 0 25px; }
    .menu-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
    .header-left { display: flex; align-items: center; gap: 14px; }
    .main-icon { 
      font-size: 1.8rem; 
      color: var(--accent-color, #00f2ff); 
      filter: drop-shadow(0 0 8px var(--accent-color, rgba(0, 242, 255, 0.3))); 
    }
    .header-left h3 { color: white; margin: 0; font-size: 1.25rem; font-weight: 800; letter-spacing: -0.3px; }
    .header-left p { color: rgba(255, 255, 255, 0.5); margin: 2px 0 0 0; font-size: 0.85rem; 
                      display: -webkit-box; -webkit-line-clamp: 1; line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
    
    .btn-all {
      display: flex; align-items: center; gap: 8px;
      color: var(--accent-color, #00f2ff); text-decoration: none; font-weight: 700; font-size: 0.8rem;
      padding: 7px 16px; border-radius: 20px; 
      background: color-mix(in srgb, var(--accent-color, #00f2ff) 10%, transparent);
      border: 1px solid color-mix(in srgb, var(--accent-color, #00f2ff) 20%, transparent);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .btn-all:hover { 
      background: color-mix(in srgb, var(--accent-color, #00f2ff) 20%, transparent);
      transform: translateX(5px);
      box-shadow: 0 0 15px color-mix(in srgb, var(--accent-color, #00f2ff) 15%, transparent);
    }

    .items-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 20px; }
    .item-card {
      position: relative; background: rgba(255, 255, 255, 0.03); border-radius: 14px;
      overflow: hidden; text-decoration: none; border: 1px solid rgba(255, 255, 255, 0.05);
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .item-card:hover { 
      transform: translateY(-4px); 
      background: rgba(255, 255, 255, 0.07); 
      border-color: var(--accent-color, rgba(0, 242, 255, 0.3));
    }

    .card-image { position: relative; height: 125px; overflow: hidden; }
    .card-image img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.6s ease; }
    .item-card:hover .card-image img { transform: scale(1.08); }

    .card-badge {
      position: absolute; top: 8px; right: 8px;
      color: white; padding: 3px 8px; border-radius: 6px; font-weight: 800; font-size: 0.65rem;
      box-shadow: 0 3px 8px rgba(0, 0, 0, 0.2); z-index: 2;
    }

    .price-tag {
      position: absolute; bottom: 0; left: 0; right: 0;
      background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%);
      padding: 15px 10px 6px; display: flex; align-items: baseline; gap: 6px; z-index: 2;
    }
    .new-price { color: var(--accent-color, #00f2ff); font-size: 1.1rem; font-weight: 900; 
                text-shadow: 0 0 10px color-mix(in srgb, var(--accent-color, #00f2ff) 30%, transparent); }
    .old-price { color: rgba(255, 255, 255, 0.4); font-size: 0.8rem; text-decoration: line-through; }

    .card-info { padding: 12px; }
    .item-title { color: white; margin: 0 0 4px 0; font-size: 0.95rem; font-weight: 700; line-height: 1.25;
                  display: -webkit-box; -webkit-line-clamp: 1; line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
    .item-meta { color: rgba(255, 255, 255, 0.4); font-size: 0.75rem; display: flex; align-items: center; gap: 5px; font-weight: 500; }
    .item-meta i { color: var(--accent-color, #00f2ff); opacity: 0.6; }

    .card-glow { 
      position: absolute; inset: 0; 
      background: radial-gradient(circle at center, color-mix(in srgb, var(--accent-color, #00f2ff) 10%, transparent) 0%, transparent 70%);
      opacity: 0; transition: opacity 0.3s ease; pointer-events: none; 
    }
    .item-card:hover .card-glow { opacity: 1; }

    .menu-footer { 
      display: flex; justify-content: center; gap: 30px; padding-top: 15px; 
      border-top: 1px solid rgba(255, 255, 255, 0.05); 
    }
    .footer-stat { display: flex; align-items: center; gap: 8px; color: rgba(255, 255, 255, 0.35); font-size: 0.75rem; font-weight: 600; }
    .footer-stat i { color: var(--accent-color, #00f2ff); font-size: 0.9rem; opacity: 0.8; }

    .fade-in-up { animation: fadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

    .item-skeleton { background: rgba(255, 255, 255, 0.02); height: 220px; border-radius: 14px; padding: 12px; }
    .skeleton-img { height: 125px; background: rgba(255, 255, 255, 0.05); border-radius: 10px; margin-bottom: 12px; }
    .skeleton-text { height: 12px; background: rgba(255, 255, 255, 0.05); border-radius: 4px; margin-bottom: 8px; }
    .skeleton-text.short { width: 40%; }

    .empty-state { grid-column: 1 / -1; text-align: center; padding: 40px; color: rgba(255, 255, 255, 0.2); }
    .empty-state i { font-size: 2.5rem; margin-bottom: 15px; }


  `]
})
export class MegaMenuComponent {
  @Input() config: MegaMenuConfig | null = null;
  @Input() items: any[] = [];
  @Input() loading = false;
  @Output() navigate = new EventEmitter<void>();

  onItemClick() { this.navigate.emit(); }

  getRoute(item: any): any[] {
    const slug = createFriendlySlug(item.titulo, item.id);
    if (item.searchType === 'VEHICULO') return ['/vehiculos', slug];
    if (item.searchType === 'PRODUCTO') return ['/productos', slug];
    // Por defecto ofertas (incluye viajes si searchType es OFERTA)
    return ['/ofertas', slug];
  }

  getBadge(item: any) {
    if (item.precioOferta === 0) return { text: '¡GRATIS!', color: '#10b981' };
    if (item.esFlash) return { text: 'FLASH', color: '#ef4444' };
    if (item.searchType === 'VEHICULO') return { text: item.tipoVehiculo || 'MOTOR', color: '#6366f1' };
    if (item.categoria?.slug === 'viajes') return { text: 'VIAJE', color: '#3b82f6' };
    
    // Default discount badge
    if (item.precioOriginal > item.precioOferta) {
      const pct = Math.round(((item.precioOriginal - item.precioOferta) / item.precioOriginal) * 100);
      return { text: `-${pct}%`, color: '#ef4444' };
    }
    return null;
  }

  getPrice(item: any) {
    return {
      current: item.precioOferta ?? item.precio,
      original: item.precioOriginal && item.precioOriginal > (item.precioOferta ?? item.precio) ? item.precioOriginal : null
    };
  }

  getMeta(item: any) {
    if (item.searchType === 'VEHICULO') return { icon: 'fas fa-gauge-high', text: `${item.kilometros?.toLocaleString()} km · ${item.combustible}` };
    if (item.categoria?.slug === 'viajes') return { icon: 'fas fa-location-dot', text: item.ciudadOferta || 'Destino Global' };
    return { icon: 'fas fa-tag', text: item.tienda || 'Chollo Local' };
  }
}
