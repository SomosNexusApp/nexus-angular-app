import { Component, inject, OnInit, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';

// Servicios
import { GuestPopupService } from './core/services/guest-popup.service';
import { AuthStore } from './core/auth/auth-store';
import { WebSocketService } from './core/services/websocket.service';
import { NotificationService, NotificacionInAppDto } from './core/services/notification.service';
import { UiService } from './core/services/ui.service';

// Popups Globales
import { RegisterPopupComponent } from './shared/components/register-popup/register-popup.component';
import { OnboardingStepperComponent } from './shared/components/onboarding-stepper/onboarding-stepper.component';
import { ToastContainerComponent } from './shared/components/toast-container/toast-container.component';
import { HeaderComponent } from './components/header/header.component';
import { SupportChatWidgetComponent } from './shared/components/support-chat-widget/support-chat-widget.component';
import { MobileHeader } from './mobile/mobile-header/mobile-header';
import { MobileBottomNav } from './mobile/mobile-bottom-nav/mobile-bottom-nav';
import { CategoriaPanelComponent } from './shared/components/categoria-panel/categoria-panel.component';
import { MobilePublishModalComponent } from './mobile/mobile-publish-modal/mobile-publish-modal';
import { FooterComponent } from './shared/components/footer/footer.component';

// componente raiz de la aplicacion. actua como shell global:
// - monta el header, footer y router-outlet
// - gestiona los popups globales (registro, onboarding, 2FA, tipo de cuenta)
// - conecta/desconecta el websocket automaticamente cuando el usuario hace login/logout
// - detecta si estamos en mobile o desktop para alternar los componentes de navegacion
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RegisterPopupComponent,
    OnboardingStepperComponent,
    ToastContainerComponent,
    HeaderComponent,
    SupportChatWidgetComponent,
    MobileBottomNav,
    MobileHeader,
    CategoriaPanelComponent,
    MobilePublishModalComponent,
    FooterComponent,
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  // el servicio de popups es publico para que el HTML pueda leer sus signals directamente
  guestPopup = inject(GuestPopupService);
  private router = inject(Router);

  private authStore = inject(AuthStore);
  private wsService = inject(WebSocketService);
  private notifService = inject(NotificationService);
  public uiService = inject(UiService);

  // signals para controlar que componentes se muestran segun la ruta actual
  isAdminRoute = signal(window.location.pathname.startsWith('/admin'));
  isMessagesRoute = signal(window.location.pathname.startsWith('/mensajes'));
  isPublishRoute = signal(window.location.pathname.startsWith('/publicar'));
  isSearchRoute = signal(window.location.pathname.startsWith('/search'));
  isMobileUI = signal(window.innerWidth <= 768); // <= 768px = movil

  // popups del flujo post-registro (se muestran en orden: 2FA → tipo cuenta → avatar)
  showTwoFactorPopup = signal(false);
  showAccountTypePopup = signal(false);

  /** banner prioritario: cuando el vendedor tiene una venta lista para enviar */
  saleBanner = signal<NotificacionInAppDto | null>(null);

  constructor() {
    // detectamos cambios de tamano para alternar entre UI mobile y desktop
    window.addEventListener('resize', () => {
      const isMobile = window.innerWidth <= 768;
      this.isMobileUI.set(isMobile);
      this.uiService.isMobileUI.set(isMobile);
    });
    // effect: se re-ejecuta automaticamente cuando cambia isLoggedIn()
    // conectamos el websocket al hacer login y lo cerramos al hacer logout
    effect(() => {
      if (this.authStore.isLoggedIn()) {
        this.wsService.connect(); // abrimos la conexion STOMP/SockJS
        this.notifService.init(); // iniciamos el contador de no leidas
        // esperamos un tick para que la sesion este lista antes de pedir notifs destacadas
        queueMicrotask(() => {
          this.notifService.getDestacadasPendientes().subscribe((list) => {
            // buscamos si hay una venta reciente pendiente de envio para mostrar el banner
            const sale = list.find(
              (n) => n.tipo === 'COMPRA_PAGADA_VENDEDOR' || n.destacada === true,
            );
            if (sale) this.saleBanner.set(sale);
          });
        });
      } else {
        // al cerrar sesion, limpiamos todo
        this.wsService.disconnect();
        this.notifService.reset();
        this.saleBanner.set(null);
      }
    });
  }

  // cierra el banner y marca la notificacion como leida en el backend
  closeSaleBanner(): void {
    const n = this.saleBanner();
    if (n?.id != null) {
      this.notifService.markAsRead(n.id).subscribe(() => this.saleBanner.set(null));
    } else {
      this.saleBanner.set(null);
    }
  }

  goMisVentas(): void {
    this.router.navigate(['/perfil'], { queryParams: { tab: 'ventas' } });
    this.closeSaleBanner();
  }

  ngOnInit() {
    // escuchamos cambios de ruta para:
    // 1. ocultar el header/popups cuando se navega a rutas de admin
    // 2. rastrear visitas de pagina para el sistema de popups periodicos
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        const url = event.urlAfterRedirects;
        const isAdmin = url.startsWith('/admin');

        this.isAdminRoute.set(isAdmin);
        const isMessages = url.startsWith('/mensajes');
        this.isMessagesRoute.set(isMessages);

        const isPublish = url.startsWith('/publicar');
        this.isPublishRoute.set(isPublish);

        const isSearch = url.startsWith('/search');
        this.isSearchRoute.set(isSearch);

        if (isAdmin) {
          this.guestPopup.hidePopup(); // en el admin no mostramos nunca el popup de registro
        } else {
          this.guestPopup.trackPageVisit(); // contamos visitas para el popup periodico
        }
      });
  }

  // --- flujo de popups post-login ---
  // el orden es: login → 2FA (si tiene) → tipo de cuenta → avatar

  onTwoFactorCompletado() {
    this.guestPopup.closeTwoFactorPopup();

    const user = this.authStore.user();
    // si el usuario todavia no tiene tipo de cuenta asignado, le pedimos que elija
    if (user && !user.tipoCuenta) {
      this.guestPopup.showAccountTypePopup();
    }
  }

  onAccountTypeCompletado() {
    this.guestPopup.closeAccountTypePopup();

    const user = this.authStore.user();
    // si entro con Google y tiene foto, le preguntamos si quiere usarla como avatar
    if (user && user.googleAvatarUrl) {
      this.guestPopup.showAvatarChoicePopup();
    } else {
      // si no es Google o no tiene foto, terminamos el flujo y vamos al home
      this.router.navigate(['/']);
    }
  }
}


