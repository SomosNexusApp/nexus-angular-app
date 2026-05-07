import { Component, Input, Output, EventEmitter, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { getCategoryIconPath } from '../../utils/category-icons';

export interface Categoria {
  id: number;
  nombre: string;
  slug: string;
  icono?: string;
  color?: string;
  orden?: number;
  activa?: boolean;
  hijos?: Categoria[];
}

@Component({
  selector: 'app-categoria-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './categoria-panel.component.html',
  styleUrls: ['./categoria-panel.component.css'],
})
export class CategoriaPanelComponent implements OnInit {
  @Input() isOpen = false;
  @Output() cerrar = new EventEmitter<void>();

  private http = inject(HttpClient);
  private router = inject(Router);

  categorias = signal<Categoria[]>([]);
  expandidas = signal<Set<number>>(new Set());
  cargando = signal(true);

  ngOnInit(): void {
    this.http.get<Categoria[]>(`${environment.apiUrl}/categorias/raiz`).subscribe({
      next: (cats) => {
        this.categorias.set(cats);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
      },
    });
  }

  toggleExpandida(id: number, event: Event): void {
    event.stopPropagation();
    const set = new Set(this.expandidas());
    set.has(id) ? set.delete(id) : set.add(id);
    this.expandidas.set(set);
  }

  esExpandida(id: number): boolean {
    return this.expandidas().has(id);
  }

  // ── Fix bug 2: slug vacío = ir al catálogo sin filtro ────────────────
  navegarA(slug: string): void {
    if (slug) {
      this.router.navigate(['/search'], { queryParams: { categoria: slug } });
    } else {
      this.router.navigate(['/search']);
    }
    this.cerrar.emit();
  }

  onOverlayClick(): void {
    this.cerrar.emit();
  }

  getIconoCategoria(cat: Categoria | null): string {
    if (!cat) return 'fas fa-layer-group';

    // Mapa de iconos por slug para asegurar coherencia con el buscador
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

    return cat.icono || 'fas fa-tag';
  }

  // Ruedas extra solo para vehículos (ya no se usa con FontAwesome pero lo dejamos por si acaso)
  esVehiculo(cat: Categoria): boolean {
    const t = (cat.slug || cat.nombre || '').toLowerCase();
    return t.includes('vehiculo') || t.includes('motor') || t.includes('moto');
  }
}
