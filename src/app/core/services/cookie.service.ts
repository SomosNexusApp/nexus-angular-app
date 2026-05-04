import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class CookieService {
  private readonly COOKIE_CONSENT_KEY = 'nexus_cookie_consent';
  
  // Usamos un signal para que la UI reaccione automáticamente
  consentAccepted = signal<boolean>(this.hasConsent());
  
  // Preferencias actuales
  currentPreferences = signal<any>(this.getStoredPreferences());

  constructor() {
    // Si ya existe consentimiento, notificamos a GTM al iniciar
    if (this.hasConsent()) {
      const prefs = this.getStoredPreferences();
      this.notifyGTM(prefs);
    }
  }

  private getStoredPreferences(): any {
    if (typeof window === 'undefined') return { essential: true, analytics: false, marketing: false };
    const stored = localStorage.getItem(this.COOKIE_CONSENT_KEY);
    try {
      return stored ? JSON.parse(stored) : { essential: true, analytics: false, marketing: false };
    } catch (e) {
      return { essential: true, analytics: true, marketing: true };
    }
  }

  private hasConsent(): boolean {
    // Comprobamos si estamos en el navegador
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(this.COOKIE_CONSENT_KEY) !== null;
  }

  acceptCookies() {
    if (typeof window !== 'undefined') {
      const prefs = { essential: true, analytics: true, marketing: true };
      localStorage.setItem(this.COOKIE_CONSENT_KEY, JSON.stringify(prefs));
      this.consentAccepted.set(true);
      this.currentPreferences.set(prefs);
      this.notifyGTM(prefs);
    }
  }

  savePreferences(preferences: any) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.COOKIE_CONSENT_KEY, JSON.stringify(preferences));
      this.consentAccepted.set(true);
      this.currentPreferences.set(preferences);
      this.notifyGTM(preferences);
    }
  }

  private notifyGTM(preferences: any) {
    if (typeof window !== 'undefined' && (window as any).dataLayer) {
      (window as any).dataLayer.push({
        event: 'cookie_consent_update',
        ...preferences
      });
    }
  }
}
