import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SearchService } from '../../../core/services/search.service';
import { SlugPipe } from '../../../shared/pipes/slug-pipe';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';

@Component({
  selector: 'app-viajes-portal',
  standalone: true,
  imports: [CommonModule, RouterModule, SlugPipe],
  template: `
    <div class="viajes-container">
      <!-- Hero Section -->
      <section class="hero-section">
        <div class="hero-content">
          <h1 class="hero-title">Nexus <span class="accent">Viajes</span></h1>
          <p class="hero-subtitle">Explora destinos increíbles con ofertas exclusivas de nuestra comunidad.</p>
        </div>
        <div class="hero-bg-glow"></div>
      </section>

      <!-- Content Grid -->
      <div class="content-wrapper">
        <div class="section-header">
          <div class="header-info">
            <svg class="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>
            <h2>Ofertas Destacadas</h2>
          </div>
          <div class="filters-placeholder">
            <span class="badge">Mostrando {{ items.length }} escapadas</span>
          </div>
        </div>

        @if (loading) {
          <div class="loading-state">
            <div class="spinner"></div>
            <p>Buscando las mejores rutas para ti...</p>
          </div>
        } @else if (items.length === 0) {
          <div class="empty-state glass">
             <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="11" r="3"/><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 0 1-2.827 0l-4.244-4.243a8 8 0 1 1 11.314 0z"/></svg>
            <h3>No hay viajes disponibles hoy</h3>
            <p>Vuelve pronto para descubrir nuevas aventuras.</p>
          </div>
        } @else {
          <div class="travel-grid" [@listAnimation]="items.length">
            @for (item of items; track item.id) {
              <div class="travel-card glass" [routerLink]="['/ofertas', item.id | slugify:item.titulo]">
                <div class="card-image-wrapper">
                  <img [src]="item.imagenPrincipal || 'assets/images/placeholder-travel.jpg'" [alt]="item.titulo">
                  <div class="price-tag glass">
                    <span class="amount">{{ item.precio | currency:'EUR':'symbol':'1.0-2' }}</span>
                  </div>
                  @if (item.precioOriginal > item.precio) {
                    <div class="discount-badge">
                      -{{ ((item.precioOriginal - item.precio) / item.precioOriginal * 100) | number:'1.0-0' }}%
                    </div>
                  }
                </div>
                
                <div class="card-content">
                  <div class="category-pill">{{ item.categoria?.nombre || 'Viaje' }}</div>
                  <h3 class="card-title">{{ item.titulo }}</h3>
                  
                  <div class="card-meta">
                    <div class="meta-item">
                      <svg class="meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="11" r="3"/><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 0 1-2.827 0l-4.244-4.243a8 8 0 1 1 11.314 0z"/></svg>
                      <span>Destino Premium</span>
                    </div>
                    <div class="meta-item">
                      <svg class="meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      <span>Oferta Limitada</span>
                    </div>
                  </div>

                  <div class="card-footer">
                    <div class="spark-rating">
                      <svg class="star-icon" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                      <span>{{ item.sparkScore || 9.8 }}</span>
                    </div>
                    <button class="btn-explore">
                      Explorar <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 18px; height: 18px;"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                    </button>
                  </div>
                </div>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: #050505;
      color: #fff;
    }

    .viajes-container {
      padding-bottom: 100px;
    }

    .hero-section {
      position: relative;
      height: 450px;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      overflow: hidden;
      background: radial-gradient(circle at center, #1a1a1a 0%, #050505 100%);
    }

    .hero-content {
      position: relative;
      z-index: 2;
      max-width: 800px;
      padding: 0 20px;
    }

    .hero-title {
      font-size: clamp(3rem, 8vw, 5rem);
      font-family: 'Outfit', sans-serif;
      font-weight: 800;
      margin-bottom: 1rem;
      letter-spacing: -0.02em;
    }

    .accent {
      background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .hero-subtitle {
      font-size: 1.25rem;
      color: #9ca3af;
      font-weight: 300;
      max-width: 600px;
      margin: 0 auto;
    }

    .hero-bg-glow {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 600px;
      height: 600px;
      background: radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%);
      filter: blur(80px);
      z-index: 1;
    }

    .content-wrapper {
      max-width: 1400px;
      margin: -60px auto 0;
      padding: 0 30px;
      position: relative;
      z-index: 10;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 40px;
      padding: 24px;
      background: rgba(255, 255, 255, 0.03);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 24px;
    }

    .header-info {
      display: flex;
      align-items: center;
      gap: 15px;
    }

    .header-icon {
      color: #3b82f6;
      width: 32px;
      height: 32px;
    }

    .header-info h2 {
      font-size: 1.75rem;
      font-weight: 700;
      margin: 0;
    }

    .badge {
      background: rgba(59, 130, 246, 0.1);
      color: #60a5fa;
      padding: 8px 16px;
      border-radius: 100px;
      font-size: 0.875rem;
      font-weight: 600;
      border: 1px solid rgba(59, 130, 246, 0.2);
    }

    .travel-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 30px;
    }

    .glass {
      background: rgba(255, 255, 255, 0.03);
      backdrop-filter: blur(40px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    }

    .travel-card {
      border-radius: 28px;
      overflow: hidden;
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      cursor: pointer;
    }

    .travel-card:hover {
      transform: translateY(-10px);
      border-color: rgba(59, 130, 246, 0.3);
      background: rgba(255, 255, 255, 0.05);
    }

    .card-image-wrapper {
      position: relative;
      height: 240px;
      overflow: hidden;
    }

    .card-image-wrapper img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.6s ease;
    }

    .travel-card:hover .card-image-wrapper img {
      transform: scale(1.1);
    }

    .price-tag {
      position: absolute;
      bottom: 20px;
      right: 20px;
      padding: 10px 20px;
      border-radius: 16px;
      font-weight: 800;
      font-size: 1.25rem;
    }

    .discount-badge {
      position: absolute;
      top: 20px;
      left: 20px;
      background: #ef4444;
      color: white;
      padding: 6px 12px;
      border-radius: 10px;
      font-weight: 700;
      font-size: 0.875rem;
    }

    .card-content {
      padding: 24px;
    }

    .category-pill {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #3b82f6;
      font-weight: 700;
      margin-bottom: 12px;
    }

    .card-title {
      font-size: 1.25rem;
      font-weight: 700;
      margin-bottom: 20px;
      line-height: 1.4;
    }

    .card-meta {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 24px;
    }

    .meta-item {
      display: flex;
      align-items: center;
      gap: 10px;
      color: #9ca3af;
      font-size: 0.9rem;
    }

    .meta-icon {
      width: 18px;
      height: 18px;
      color: #4b5563;
    }

    .card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 20px;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
    }

    .spark-rating {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 700;
      color: #fbbf24;
    }

    .star-icon {
      width: 18px;
      height: 18px;
    }

    .btn-explore {
      background: #fff;
      color: #000;
      border: none;
      padding: 10px 20px;
      border-radius: 14px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.3s ease;
    }

    .btn-explore:hover {
      background: #3b82f6;
      color: white;
    }

    .loading-state {
      padding: 100px 0;
      text-align: center;
    }

    .spinner {
      width: 50px;
      height: 50px;
      border: 3px solid rgba(255, 255, 255, 0.1);
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .empty-state {
      padding: 80px;
      text-align: center;
      border-radius: 32px;
    }

    .empty-icon {
      width: 64px;
      height: 64px;
      color: #374151;
      margin-bottom: 20px;
    }
  `],
  animations: [
    trigger('listAnimation', [
      transition('* <=> *', [
        query(':enter', [
          style({ opacity: 0, transform: 'translateY(20px)' }),
          stagger('100ms', [
            animate('500ms cubic-bezier(0.4, 0, 0.2, 1)', style({ opacity: 1, transform: 'translateY(0)' }))
          ])
        ], { optional: true })
      ])
    ])
  ]
})
export class ViajesPortalComponent implements OnInit {
  private searchService = inject(SearchService);

  items: any[] = [];
  loading = true;

  ngOnInit() {
    this.loadViajes();
  }

  loadViajes() {
    this.loading = true;
    this.searchService.buscar({ 
      categoria: 'viajes', 
      tipo: 'OFERTA',
      size: 50 
    }).subscribe({
      next: (res) => {
        this.items = res.items;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }
}
