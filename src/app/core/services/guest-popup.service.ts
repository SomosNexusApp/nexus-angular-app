import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from '../auth/auth-store';
import { UiService } from './ui.service';

// servicio central para todos los popups/modales de la aplicacion
// gestiona: popup de registro para invitados, onboarding, 2FA, tipo de cuenta y eleccion de avatar
// usamos signals de Angular 17+ para que los componentes reaccionen automaticamente al estado
@Injectable({ providedIn: 'root' })
export class GuestPopupService {
  private authStore = inject(AuthStore);
  private router    = inject(Router);

  // --- estados del popup de registro para invitados ---
  readonly isOpen = signal<boolean>(false);
  readonly motivo = signal<string>(''); // mensaje que se muestra en el popup
  readonly pageVisits = signal<number>(0); // contador de visitas para el popup periodico
  private lastShown: number = 0; // timestamp de la ultima vez que se mostro el popup

  // estados del popup de terminos OAuth (cuando el usuario se registra con Google)
  readonly isOAuthTermsOpen = signal<boolean>(false);

  // --- popup de invitados (registro) ---

  showPopup(motivo?: string): void {
    const isMobile = this.uiService.isMobileUI();
    const url = this.router.url.toLowerCase();
    const isAuthRoute = url.includes('/login') || url.includes('/register');

    // 1. Bloqueamos en móvil (según petición: "no salga ni en la aplicación móviles")
    if (isMobile) return;

    // 2. Bloqueamos en rutas de autenticación (login/register)
    if (isAuthRoute) return;

    // 3. Bloqueamos en la zona admin
    if (url.includes('/admin') || window.location.pathname.includes('/admin')) {
      console.log('[GuestPopup] Bloqueado popup en ruta admin.');
      return;
    }

    // 4. Si ya está logueado no tiene sentido mostrar el popup de registro
    if (this.authStore.isLoggedIn()) return;

    this.motivo.set(motivo || 'Únete a Nexus');
    this.isOpen.set(true);
    this.lastShown = Date.now(); // guardamos cuando se muestra para no repetirlo muy pronto
  }

  private uiService = inject(UiService);

  // --- states of the other onboarding popups ---
  // we have them as separate signals so each popup is independent
  readonly isTwoFactorOpen = signal<boolean>(false);
  readonly isAccountTypeOpen = signal<boolean>(false);
  readonly isAvatarChoiceOpen = signal<boolean>(false);
  readonly isOnboardingOpen = signal<boolean>(false); // the welcome stepper for new users

  showTwoFactorPopup(): void {
    this.isTwoFactorOpen.set(true);
  }

  hideTwoFactorPopup(): void {
    this.isTwoFactorOpen.set(false);
  }

  closeTwoFactorPopup(): void {
    this.hideTwoFactorPopup();
  }

  showAccountTypePopup(): void {
    this.isAccountTypeOpen.set(true);
  }

  closeAccountTypePopup(): void {
    this.isAccountTypeOpen.set(false);
  }

  showAvatarChoicePopup(): void {
    this.isAvatarChoiceOpen.set(true);
  }

  closeAvatarChoicePopup(): void {
    this.isAvatarChoiceOpen.set(false);
  }

  showOnboarding(): void {
    this.isOnboardingOpen.set(true);
  }

  closeOnboarding(): void {
    this.isOnboardingOpen.set(false);
  }

  /**
   * closes the guest popup.
   * we have two names (hidePopup and closePopup) so it works both
   * from auth.service and from login.component without breaking anything
   */
  hidePopup(): void {
    this.isOpen.set(false);
    this.motivo.set('');
  }

  closePopup(): void {
    this.hidePopup(); // alias of hidePopup
  }

  // --- logic for showing the popup periodically to unregistered users ---

  trackPageVisit(): void {
    // we don't show commercial popups in the admin zone
    if (this.router.url.includes('/admin') || window.location.pathname.includes('/admin')) return;

    this.pageVisits.update((v) => v + 1);

    // if requirements met, show the popup automatically
    if (this.debeSalirPeriodico()) {
      this.showPopup('Descubre todas las ventajas de Nexus');
    }
  }

  private debeSalirPeriodico(): boolean {
    const isGuest = !this.authStore.isLoggedIn();
    const enoughVisits = this.pageVisits() >= 4; // minimum 4 visits before bothering
    const timePassed = Date.now() - this.lastShown > 5 * 60 * 1000; // and 5 min must have passed

    // NEW: Don't show on mobile or on auth routes (login/register)
    const isMobile = this.uiService.isMobileUI();
    const currentUrl = this.router.url.toLowerCase();
    const isAuthRoute = currentUrl.includes('/login') || currentUrl.includes('/register');

    return isGuest && enoughVisits && timePassed && !isMobile && !isAuthRoute;
  }

  // --- POPUP TÉRMINOS OAUTH ---

  showOAuthTermsPopup(): void {
    this.isOAuthTermsOpen.set(true);
  }

  /**
   * Alias adicionales por si tus componentes llaman a hide o close
   */
  closeOAuthTermsPopup(): void {
    this.isOAuthTermsOpen.set(false);
  }

  hideOAuthTermsPopup(): void {
    this.closeOAuthTermsPopup();
  }
}
