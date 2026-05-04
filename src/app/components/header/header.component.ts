import { Component, inject, OnInit, OnDestroy, signal, HostListener, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { debounceTime, distinctUntilChanged, filter, Subject, takeUntil } from 'rxjs';

import { AuthStore } from '../../core/auth/auth-store';
import { AuthService } from '../../core/auth/auth.service';
import { GuestPopupService } from '../../core/services/guest-popup.service';
import { SearchService } from '../../core/services/search.service';
import { NotificationService, NotificacionInAppDto } from '../../core/services/notification.service';
import { WebSocketService } from '../../core/services/websocket.service';
import { ConfirmModalComponent } from '../../shared/components/confirm-modal/confirm-modal.component';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { MegaMenuComponent, MegaMenuConfig } from '../../shared/components/mega-menu/mega-menu.component';
import { UiService } from '../../core/services/ui.service';
import { environment } from '../../../environments/environment';

interface NavLink {
  label: string;
  route: string;
  queryParams?: Record<string, string>;
  icon: string;
}

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    ConfirmModalComponent,
    AvatarComponent,
    MegaMenuComponent,
  ],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
})
export class HeaderComponent implements OnInit, OnDestroy {
  private authStore = inject(AuthStore);
  private authService = inject(AuthService);
  public guestPopup = inject(GuestPopupService);
  private router = inject(Router);
  public notificationService = inject(NotificationService);
  public wsService = inject(WebSocketService);
  private searchService = inject(SearchService);
  public uiService = inject(UiService);
  private http = inject(HttpClient);
  public environment = environment;

  private destroy$ = new Subject<void>();

  // Signals del store
  readonly isLoggedIn = this.authStore.isLoggedIn;
  readonly usuario = this.authStore.user;

  // UI state
  readonly isUserDropdownOpen = signal(false);
  readonly isNotifPanelOpen = signal(false);
  readonly isMobileMenuOpen = signal(false);
  readonly notifItems = signal<NotificacionInAppDto[]>([]);

  // Buscador
  searchControl = new FormControl('');
  readonly isSearchHistoryVisible = signal(false);
  readonly searchHistory = signal<string[]>([]);

  // Categorias & Mega Menus
  readonly isCategoriasPanelOpen = this.uiService.isCategoriasPanelOpen;
  readonly activeMenuId = signal<string | null>(null);
  readonly menuItems = signal<any[]>([]);
  readonly loadingMenu = signal(false);

  private panelTimeout: any;

  @ViewChild('logoutModal') logoutModal!: ConfirmModalComponent;

  navLinks: NavLink[] = [
    { label: 'Categorías', route: '/search', icon: 'grid' },
    { label: 'Ofertas Flash', route: '/ofertas', icon: 'flash' },
    { label: 'Vehículos', route: '/vehiculos', icon: 'car' },
    { label: 'Viajes', route: '/viajes', icon: 'plane' },
    { label: 'Cerca de ti', route: '/cerca', icon: 'pin' },
    { label: 'Gratis', route: '/gratis', icon: 'gift' },
  ];

  toggleMobileMenu(): void {
    this.isMobileMenuOpen.update(v => !v);
    if (this.isMobileMenuOpen()) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }

  megaMenuConfigs: Record<string, MegaMenuConfig> = {
    flash: {
      id: 'flash',
      title: 'Ofertas Flash',
      subtitle: 'Chollos de tiempo limitado que desaparecen en horas',
      icon: 'fas fa-bolt-lightning',
      accentColor: '#ef4444',
      viewAllLink: '/ofertas'
    },
    vehiculos: {
      id: 'vehiculos',
      title: 'Nexus Motor',
      subtitle: 'Encuentra tu próximo coche, moto o furgoneta',
      icon: 'fas fa-car-side',
      accentColor: '#6366f1',
      viewAllLink: '/search',
      viewAllParams: { tipo: 'VEHICULO' }
    },
    viajes: {
      id: 'viajes',
      title: 'Nexus Viajes',
      subtitle: 'Explora el mundo con ofertas exclusivas',
      icon: 'fas fa-plane-departure',
      accentColor: '#3b82f6',
      viewAllLink: '/search',
      viewAllParams: { tipo: 'OFERTA', categoria: 'viajes' }
    },
    cerca: {
      id: 'cerca',
      title: 'Cerca de ti',
      subtitle: 'Descubre los mejores chollos en tu zona',
      icon: 'fas fa-location-dot',
      accentColor: '#f59e0b',
      viewAllLink: '/search',
      viewAllParams: { tipo: 'OFERTA', orden: 'distancia' }
    },
    gratis: {
      id: 'gratis',
      title: 'Cosas Gratis',
      subtitle: 'Muestras, regalos y artículos a 0€',
      icon: 'fas fa-gift',
      accentColor: '#10b981',
      viewAllLink: '/search',
      viewAllParams: { tipo: 'OFERTA', precioMax: 0 }
    }
  };

  ngOnInit() {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntil(this.destroy$),
      )
      .subscribe(() => {
        const urlTree = this.router.parseUrl(this.router.url);
        const q = (urlTree.queryParams['q'] as string) ?? '';
        if (this.searchControl.value !== q) {
          this.searchControl.setValue(q, { emitEvent: false });
        }
      });

    this.searchControl.valueChanges
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((value) => {
        this.ejecutarBusqueda(value ?? '');
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // --- Mega Menu logic ---
  onHover(menuId: string): void {
    if (this.panelTimeout) clearTimeout(this.panelTimeout);
    
    if (this.activeMenuId() === menuId) return;

    this.activeMenuId.set(menuId);
    this.isCategoriasPanelOpen.set(false);
    this.loadMenuData(menuId);
  }

  onLeave(): void {
    if (this.panelTimeout) clearTimeout(this.panelTimeout);
    this.panelTimeout = setTimeout(() => {
      this.closeAllPanels();
    }, 200);
  }

  toggleCategoriasPanel(): void {
    this.uiService.toggleCategoriasPanel();
    this.activeMenuId.set(null);
  }

  private loadMenuData(menuId: string): void {
    this.loadingMenu.set(true);
    const config = this.megaMenuConfigs[menuId];
    if (!config) return;

    if (menuId === 'flash') {
      const usuarioId = this.authStore.user()?.id;
      let url = `${environment.apiUrl}/oferta/flash`;
      if (usuarioId) url += `?usuarioId=${usuarioId}`;
      this.http.get<any[]>(url).subscribe({
        next: (res) => {
          this.menuItems.set((res || []).slice(0, 4));
          this.loadingMenu.set(false);
        },
        error: () => this.loadingMenu.set(false)
      });
    } else {
      this.searchService.buscar({
        ...config.viewAllParams,
        size: 4
      }).subscribe({
        next: (res) => {
          let items = res.items || [];
          if (menuId === 'cerca' && items.length > 0) {
            items = [...items].sort(() => Math.random() - 0.5);
          }
          this.menuItems.set(items.slice(0, 4));
          this.loadingMenu.set(false);
        },
        error: () => this.loadingMenu.set(false)
      });
    }
  }

  closeAllPanels(): void {
    this.activeMenuId.set(null);
    this.uiService.closeCategoriasPanel();
    this.menuItems.set([]);
  }

  // --- Buscador ---
  ejecutarBusqueda(query: string) {
    const q = query.trim();
    if (q) {
      this.saveSearchQuery(q);
      this.isSearchHistoryVisible.set(false);
      this.router.navigate(['/search'], { queryParams: { q } });
    } else if (this.router.url.startsWith('/search')) {
      this.router.navigate(['/search'], {
        queryParams: { q: null },
        queryParamsHandling: 'merge',
      });
    }
  }

  loadSearchHistory() {
    const history = localStorage.getItem('nexus_search_history');
    if (history) {
      try {
        this.searchHistory.set(JSON.parse(history));
      } catch (e) {
        this.searchHistory.set([]);
      }
    }
  }

  saveSearchQuery(query: string) {
    if (!query.trim()) return;
    const current = this.searchHistory();
    const updated = [query, ...current.filter((q) => q !== query)].slice(0, 10);
    this.searchHistory.set(updated);
    localStorage.setItem('nexus_search_history', JSON.stringify(updated));
  }

  removeHistoryItem(event: Event, query: string) {
    event.stopPropagation();
    const updated = this.searchHistory().filter((q) => q !== query);
    this.searchHistory.set(updated);
    localStorage.setItem('nexus_search_history', JSON.stringify(updated));
  }

  clearHistory(event: Event) {
    event.stopPropagation();
    this.searchHistory.set([]);
    localStorage.removeItem('nexus_search_history');
  }

  onSearchFocus() {
    this.loadSearchHistory();
    if (this.searchHistory().length > 0) {
      this.isSearchHistoryVisible.set(true);
    }
  }

  onSearchBlur() {
    setTimeout(() => this.isSearchHistoryVisible.set(false), 250);
  }

  selectHistoryItem(query: string) {
    this.searchControl.setValue(query, { emitEvent: false });
    this.ejecutarBusqueda(query);
  }

  limpiarBuscador() {
    this.searchControl.setValue('');
  }

  // --- Dropdown usuario ---
  toggleUserDropdown(event: Event) {
    event.stopPropagation();
    this.isUserDropdownOpen.update((v) => !v);
  }

  @HostListener('document:click')
  closeDropdown() {
    this.isUserDropdownOpen.set(false);
    this.isNotifPanelOpen.set(false);
  }

  toggleNotifPanel(event: Event) {
    event.stopPropagation();
    if (!this.isLoggedIn()) {
      this.guestPopup.showPopup('Inicia sesión para ver notificaciones');
      return;
    }
    this.isNotifPanelOpen.update((v) => !v);
    if (this.isNotifPanelOpen()) {
      this.notificationService.getAll(0).subscribe((page: any) => {
        const list = page?.content ?? page?.contenido ?? [];
        this.notifItems.set(Array.isArray(list) ? list : []);
      });
    }
  }

  openNotification(n: NotificacionInAppDto) {
    if (!n.leida) {
      this.notificationService.markAsRead(n.id).subscribe(() => {
        this.notifItems.update((items) =>
          items.map((x) => (x.id === n.id ? { ...x, leida: true } : x)),
        );
      });
    }
    this.isNotifPanelOpen.set(false);
    if (n.url) {
      this.router.navigateByUrl(n.url);
    }
  }

  marcarTodasLeidas() {
    this.notificationService.markAllAsRead().subscribe(() => {
      this.notifItems.update((items) => items.map((x) => ({ ...x, leida: true })));
    });
  }

  // --- Acciones ---
  onPublicarClick() {
    if (this.isLoggedIn()) {
      this.router.navigate(['/publicar']);
    } else {
      this.guestPopup.showPopup('Para publicar necesitas una cuenta');
    }
  }

  onFavoritosClick() {
    if (this.isLoggedIn()) {
      this.router.navigate(['/perfil'], { queryParams: { tab: 'favoritos' } });
    } else {
      this.guestPopup.showPopup('Para guardar favoritos');
    }
  }

  logout() {
    this.logoutModal.open();
  }

  confirmLogout() {
    this.authService.logout();
  }

  getIniciales(nombre?: string, apellidos?: string): string {
    let i = '';
    if (nombre) i += nombre.charAt(0).toUpperCase();
    if (apellidos) i += apellidos.charAt(0).toUpperCase();
    return i || 'U';
  }

  isNavActive(link: NavLink): boolean {
    const url = this.router.url;
    if (link.queryParams) {
      const tree = this.router.parseUrl(url);
      return (
        url.startsWith(link.route) &&
        Object.entries(link.queryParams).every(([k, v]) => tree.queryParams[k] === v)
      );
    }
    return url.startsWith(link.route);
  }
}
