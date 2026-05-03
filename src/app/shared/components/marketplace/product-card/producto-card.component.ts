import { Component, Input, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { CurrencyEsPipe } from '../../../pipes/currency-es.pipe';
import { TimeAgoPipe } from '../../../pipes/time-ago.pipe';
import { SkeletonCardComponent } from '../../skeleton-card/skeleton-card.component';
import { CoverImagePipe } from '../../../pipes/cover-image.pipe';
import { MarketplaceItem } from '../../../../models/marketplace-item.model';
import { AuthStore } from '../../../../core/auth/auth-store';
import { FavoritoService } from '../../../../core/services/favorito.service';
import { createFriendlySlug } from '../../../../shared/utils/slug-utils';

@Component({
  selector: 'app-producto-card',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    CurrencyEsPipe,
    TimeAgoPipe,
    SkeletonCardComponent,
    CoverImagePipe,
  ],
  templateUrl: './producto-card.component.html',
  styleUrls: ['./producto-card.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductoCardComponent implements OnInit {
  @Input() producto!: MarketplaceItem;
  @Input() isSkeleton = false;
  @Input() showFavorito = true;
  @Input() isMobileFeed = false;

  private router = inject(Router);
  private authStore = inject(AuthStore);
  private favService = inject(FavoritoService);

  esFavorito = signal(false);
  animandoCorazon = signal(false);

  ngOnInit(): void {
    if (this.authStore.isLoggedIn()) {
      this.favService.getFavoritosIds().subscribe(ids => {
        if (this.producto?.id) {
          const type = (this.producto.searchType || 'producto').toLowerCase();
          this.esFavorito.set(ids.includes(`${type}_${this.producto.id}`));
        }
      });
    }
  }

  get isLoggedIn(): boolean {
    return this.authStore.isLoggedIn();
  }

  get formatCondicion(): string {
    const c = this.producto?.condicion;
    if (!c) return '';
    const map: Record<string, string> = {
      NUEVO: 'Nuevo',
      COMO_NUEVO: 'Como nuevo',
      MUY_BUEN_ESTADO: 'Muy buen estado',
      BUEN_ESTADO: 'Buen estado',
      ACEPTABLE: 'Aceptable',
    };
    return map[c] ?? c.replace(/_/g, ' ');
  }

  get condicionClass(): string {
    const c = this.producto?.condicion;
    const map: Record<string, string> = {
      NUEVO: 'cond-nuevo',
      COMO_NUEVO: 'cond-como-nuevo',
      MUY_BUEN_ESTADO: 'cond-muy-buen',
      BUEN_ESTADO: 'cond-buen',
      ACEPTABLE: 'cond-aceptable',
    };
    return c ? (map[c] ?? '') : '';
  }

  get isVendido(): boolean {
    return this.producto?.estado === 'VENDIDO';
  }

  get isReservado(): boolean {
    return this.producto?.estado === 'RESERVADO';
  }

  get formattedLocation(): string {
    const loc = this.producto?.ubicacion;
    if (!loc) return 'España';

    const parts = loc.split(',').map((p) => p.trim());
    if (parts.length >= 3) {
      // Sevilla, Andalucía, España -> Sevilla, España
      return `${parts[0]}, ${parts[parts.length - 1]}`;
    }
    return loc;
  }

  navigateToDetail(event: MouseEvent): void {
    const slug = createFriendlySlug(this.producto.titulo, this.producto.id);
    this.router.navigate(['/productos', slug]);
  }

  toggleFavorito(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();

    if (!this.isLoggedIn) {
      console.log('Guest: mostrar popup favoritos');
      return;
    }

    const id = this.producto.id;
    if (!id) return;

    this.animandoCorazon.set(true);
    const becomingFav = !this.esFavorito();
    const type = (this.producto.searchType || 'producto').toLowerCase() as any;
    
    // Update local state early for responsiveness
    this.esFavorito.set(becomingFav);

    const req = becomingFav ? this.favService.addFavorito(id, type) : this.favService.removeFavorito(id, type);

    req.subscribe({
      error: () => {
        // Rollback state on error
        this.esFavorito.set(!becomingFav);
      },
      complete: () => {
        setTimeout(() => this.animandoCorazon.set(false), 400);
      }
    });
  }
}
