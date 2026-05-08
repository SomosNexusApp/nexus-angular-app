import {
  Component,
  OnInit,
  signal,
  inject,
  ChangeDetectionStrategy,
  ViewChild,
  ElementRef,
  OnDestroy,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { getCategoryColor } from '../../../shared/utils/category-icons';

export interface Categoria {
  id: number;
  nombre: string;
  slug: string;
  icono?: string;
  color?: string;
  totalProductos?: number;
}

@Component({
  selector: 'app-categorias-rapidas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './categorias-rapidas.component.html',
  styleUrls: ['./categorias-rapidas.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoriasRapidasComponent implements OnInit, OnDestroy, AfterViewInit {
  private http = inject(HttpClient);
  private router = inject(Router);

  @ViewChild('scrollTrack') scrollTrack!: ElementRef<HTMLDivElement>;

  categorias = signal<Categoria[]>([]);
  loading = signal(true);
  error = signal(false);

  // Drag state
  private isDragging = false;
  private startX = 0;
  private scrollLeft = 0;
  private isPaused = false;
  private animationId: any;
  private hasMoved = false;
  private preciseScroll = 0;

  readonly skeletons = Array(10).fill(0);

  ngOnInit() {
    this.http.get<any>(`${environment.apiUrl}/categorias/raiz`).subscribe({
      next: (res) => {
        const data: Categoria[] = Array.isArray(res) ? res : (res?.content ?? res?.data ?? []);
        this.categorias.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  ngAfterViewInit() {
    this.startAutoScroll();
  }

  ngOnDestroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }

  // --- Dragging Logic ---
  onMouseDown(e: MouseEvent) {
    if (this.loading()) return;
    this.isDragging = true;
    this.isPaused = true;
    const track = this.scrollTrack.nativeElement;
    track.classList.add('is-dragging');
    this.startX = e.pageX - track.offsetLeft;
    this.scrollLeft = track.scrollLeft;
    this.hasMoved = false;
  }

  onMouseMove(e: MouseEvent) {
    if (!this.isDragging) return;
    e.preventDefault();
    this.hasMoved = true;
    const track = this.scrollTrack.nativeElement;
    const x = e.pageX - track.offsetLeft;
    const walk = (x - this.startX) * 1.4; // Slightly slower drag speed multiplier
    track.scrollLeft = this.scrollLeft - walk;
  }

  onMouseUp() {
    this.isDragging = false;
    const track = this.scrollTrack.nativeElement;
    track.classList.remove('is-dragging');
    // We don't automatically resume auto-scroll here to allow user to read.
    // It will resume when mouse leaves the zone.
  }

  // --- Auto Scroll Logic ---
  private startAutoScroll() {
    const scroll = () => {
      if (!this.isPaused && !this.isDragging && this.scrollTrack) {
        const track = this.scrollTrack.nativeElement;
        
        // Use a precise internal value to avoid integer rounding issues in scrollLeft
        this.preciseScroll += 0.3; 
        track.scrollLeft = this.preciseScroll;

        // Loop back seamlessly
        if (this.preciseScroll >= track.scrollWidth / 2) {
          this.preciseScroll = 0;
          track.scrollLeft = 0;
        }
      } else if (this.scrollTrack) {
        // Sync preciseScroll with actual scroll position when paused or dragging
        this.preciseScroll = this.scrollTrack.nativeElement.scrollLeft;
      }
      this.animationId = requestAnimationFrame(scroll);
    };
    this.animationId = requestAnimationFrame(scroll);
  }

  pauseAutoScroll() {
    this.isPaused = true;
  }

  resumeAutoScroll() {
    this.isPaused = false;
  }

  getAccentColor(cat: Categoria): string {
    return cat.color ?? getCategoryColor(cat.slug ?? cat.nombre);
  }

  navegar(slug: string) {
    if (this.hasMoved) return;
    this.router.navigate(['/search'], { queryParams: { categoria: slug } });
  }

  getIconoCategoria(cat: Categoria | null): string {
    if (!cat) return 'fas fa-layer-group';

    // Mapa de iconos por slug para asegurar que siempre haya uno "de verdad"
    const iconMap: { [key: string]: string } = {
      juguetes: 'fas fa-puzzle-piece',
      motos: 'fas fa-motorcycle',
      moto: 'fas fa-motorcycle',
      moviles: 'fas fa-mobile-screen-button',
      telefonia: 'fas fa-mobile-screen-button',
      informatica: 'fas fa-laptop',
      electronica: 'fas fa-microchip',
      coches: 'fas fa-car',
      coche: 'fas fa-car',
      hogar: 'fas fa-house-user',
      muebles: 'fas fa-couch',
      inmuebles: 'fas fa-building',
      deportes: 'fas fa-basketball',
      libros: 'fas fa-book',
      camaras: 'fas fa-camera',
      audio: 'fas fa-headphones',
      consolas: 'fas fa-gamepad',
      electrodomesticos: 'fas fa-blender',
      zapatillas: 'fas fa-shoe-prints',
      zapatos: 'fas fa-shoe-prints',
      calzado: 'fas fa-shoe-prints',
      moda: 'fas fa-shirt',
      ropa: 'fas fa-shirt',
      vuelos: 'fas fa-plane',
      viajes: 'fas fa-plane-departure',
      vehiculos: 'fas fa-car',
      videojuegos: 'fas fa-gamepad',
      otros: 'fas fa-box-archive',
    };

    const slug = cat.slug?.toLowerCase();
    if (slug && iconMap[slug]) return iconMap[slug];

    let ico = cat.icono || 'fas fa-tag';
    // Normalizar icono si viene incompleto
    if (ico && !ico.includes('fa-')) ico = 'fa-' + ico;
    if (ico && !ico.includes('fas') && !ico.includes('fab') && !ico.includes('far'))
      ico = 'fas ' + ico;

    return ico;
  }
}
