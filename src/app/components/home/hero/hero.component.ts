import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SearchService } from '../../../core/services/search.service';
import { AuthStore } from '../../../core/auth/auth-store';
import { GuestPopupService } from '../../../core/services/guest-popup.service';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { createFriendlySlug } from '../../../shared/utils/slug-utils';
import { of } from 'rxjs';

interface ProductSlide {
  id?: number;
  user: string;
  avatar: string;
  googleAvatarUrl?: string;
  price: string;
  image: string;
  badge: string;
  badgeIconColor: string;
  title: string;
  rating: string;
}

@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [CommonModule, AvatarComponent],
  templateUrl: './hero.component.html',
  styleUrls: ['./hero.component.css'],
})
export class HeroComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private searchService = inject(SearchService);
  private authStore = inject(AuthStore);
  private guestPopupService = inject(GuestPopupService);

  slides: ProductSlide[] = [];
  currentIndex = 0;
  private autoPlayInterval: any;

  ngOnInit(): void {
    this.loadDailyProducts();
  }

  ngOnDestroy(): void {
    this.stopAutoPlay();
  }

  private loadDailyProducts() {
    this.searchService.buscar({ size: 100, tipo: 'PRODUCTO' }).subscribe((res) => {
      const all = res.items || [];
      // Filtrar solo productos disponibles que tengan imagen
      const disponibles = all.filter(p => (p as any).estado === 'DISPONIBLE' && (p as any).imagenPrincipal);
      
      if (disponibles.length === 0) {
        this.slides = [];
        return;
      }

      // Mezcla pseudo-aleatoria basada en la fecha para que cambien cada día pero sean consistentes para todos
      const today = new Date().toDateString();
      const seed = today.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      
      // Shuffle determinista con la semilla del día
      const shuffled = [...disponibles].sort((a, b) => {
        const hashA = (a.id || 0) * seed % 100;
        const hashB = (b.id || 0) * seed % 100;
        return hashA - hashB;
      });

      // Tomar los primeros 3
      this.slides = shuffled.slice(0, 3).map((item) => this.mapToSlide(item));
      this.startAutoPlay();
    });
  }

  private mapToSlide(item: any): ProductSlide {
    // El modelo Producto ya incluye el vendedor si se carga por REST
    const seller = (item as any).vendedor;
    let sellerName = seller?.user || seller?.nombre || 'Nexus User';
    if (!sellerName.startsWith('@')) sellerName = `@${sellerName}`;
    
    return {
      id: item.id,
      user: sellerName,
      avatar: seller?.avatar || '',
      googleAvatarUrl: seller?.googleAvatarUrl,
      price: `${item.precio}€`,
      image: item.imagenPrincipal || 'assets/placeholder.png',
      badge: 'Destacado',
      badgeIconColor: '#6366F1',
      title: item.titulo,
      rating: '★★★★★'
    };
  }

  startAutoPlay(): void {
    this.stopAutoPlay();
    this.autoPlayInterval = setInterval(() => { this.nextSlide(); }, 6000);
  }

  stopAutoPlay(): void {
    if (this.autoPlayInterval) clearInterval(this.autoPlayInterval);
  }

  nextSlide(): void { 
    if (this.slides.length === 0) return;
    this.currentIndex = (this.currentIndex + 1) % this.slides.length; 
  }
  
  prevSlide(): void { 
    if (this.slides.length === 0) return;
    this.currentIndex = (this.currentIndex - 1 + this.slides.length) % this.slides.length; 
  }
  
  goToSlide(index: number): void { 
    this.currentIndex = index; 
    this.startAutoPlay(); 
  }

  goToProduct(index: number) {
    const slide = this.slides[index];
    if (slide?.id) {
      const slug = createFriendlySlug(slide.title, slide.id);
      this.router.navigate(['/productos', slug]);
    }
  }


  onSellNowClick(): void {
    if (this.authStore.isLoggedIn()) this.router.navigate(['/publicar']);
    else this.guestPopupService.showPopup('Empieza a vender en Nexus');
  }

  onExploreClick(): void { this.router.navigate(['/search']); }
}
