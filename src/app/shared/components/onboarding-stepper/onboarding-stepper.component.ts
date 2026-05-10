import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthStore } from '../../../core/auth/auth-store';
import { GuestPopupService } from '../../../core/services/guest-popup.service';
import { environment } from '../../../../environments/environment';
import { AvatarComponent } from '../avatar/avatar.component';

@Component({
  selector: 'app-onboarding-stepper',
  standalone: true,
  imports: [CommonModule, FormsModule, AvatarComponent],
  templateUrl: './onboarding-stepper.component.html',
  styleUrls: ['./onboarding-stepper.component.css']
})
export class OnboardingStepperComponent implements OnInit {
  public popupService = inject(GuestPopupService);
  private authStore = inject(AuthStore);
  private http = inject(HttpClient);
  private router = inject(Router);

  currentStep = 0;
  isLoading = signal(false);
  showTotpConfig = false;
  totpData: any = null;
  isTotpVerified = false;

  user = this.authStore.user;

  localState = {
    termsAccepted: false,
    newsletter: false,
    securityMethod: 'NONE',   // 'NONE', 'EMAIL', 'TOTP'
    accountType: 'PERSONAL',  // 'PERSONAL', 'EMPRESA'
    avatarChoice: 'INITIALS', // 'GOOGLE', 'INITIALS', 'CUSTOM'
    totpCode: '',
    cif: '',
    nombreComercial: '',
    descripcion: '',
    web: '',
    customAvatarPreview: null as string | null,
    customAvatarFile: null as File | null
  };

  ngOnInit() {
    const u = this.user();
    if (!this.isSocialUser) {
      // Usuario de email: ya aceptó términos en el registro
      this.localState.termsAccepted = true;

      // Si el usuario tiene rol EMPRESA (ya fue convertido), saltamos al paso del avatar
      if (u?.rol === 'ROLE_EMPRESA') {
        this.localState.accountType = 'EMPRESA';
        this.currentStep = 3; // ir directamente al avatar
      } else {
        this.currentStep = 1; // empezar por seguridad
      }
    }
  }

  // ── helpers ──────────────────────────────────────────────────────────────────

  /** True si el usuario se registró mediante Google OAuth */
  get isSocialUser(): boolean {
    return !!this.user()?.googleId;
  }

  /** True si el avatar de Google es una foto real (no un placeholder generado) */
  get isGoogleAvatarReal(): boolean {
    const url = this.user()?.googleAvatarUrl;
    if (!url) return false;
    if (url.includes('ui-avatars.com')) return false;
    if (url.includes('googleusercontent.com') && url.includes('/a/')) {
      const parts = url.split('/a/');
      if (parts.length > 1) {
        const token = parts[1].split('=')[0];
        if (token.length < 30) return false;
      }
    }
    return true;
  }

  get userInitials(): string {
    const u = this.user();
    if (!u) return 'N';
    const name = u.nombre || u.user || 'N';
    return name.charAt(0).toUpperCase();
  }

  /**
   * El último paso es:
   *  - Paso 3 (avatar) si el usuario es de Google
   *  - Paso 2 (tipo de cuenta) si el usuario registró con email → no hay paso de avatar,
   *    se asignan iniciales automáticamente.
   */
  get isLastStep(): boolean {
    return this.currentStep === 3;
  }

  /** Número total de pasos a mostrar (para los indicadores) */
  get totalSteps(): number {
    return this.isSocialUser ? 4 : 3;
  }

  get minStep(): number {
    return this.isSocialUser ? 0 : 1;
  }

  canContinue(): boolean {
    if (this.currentStep === 0) return this.localState.termsAccepted;
    if (this.currentStep === 1 && this.localState.securityMethod === 'TOTP') return this.isTotpVerified;
    if (this.currentStep === 2 && this.localState.accountType === 'EMPRESA') {
      return !!this.localState.cif && !!this.localState.nombreComercial;
    }
    if (this.currentStep === 3) {
      if (this.localState.avatarChoice === 'CUSTOM' && !this.localState.customAvatarPreview) return false;
    }
    return true;
  }

  nextStep() {
    if (this.isLastStep) {
      this.finish();
      return;
    }

    this.isLoading.set(true);

    if (this.currentStep === 0) {
      this.saveTerms();
    } else if (this.currentStep === 1) {
      this.saveSecurity();
    } else if (this.currentStep === 2) {
      this.saveAccountType();
    } else {
      this.currentStep++;
      this.isLoading.set(false);
    }
  }

  prevStep() {
    if (this.currentStep > this.minStep) this.currentStep--;
  }

  // ── pasos ─────────────────────────────────────────────────────────────────────

  private saveTerms() {
    const payload = {
      terminosAceptados: this.localState.termsAccepted,
      newsletterSuscrito: this.localState.newsletter,
      versionTerminosAceptados: '1.0'
    };

    this.http.patch(`${environment.apiUrl}/api/usuario/me/terminos`, payload).subscribe({
      next: () => {
        this.currentStep++;
        this.isLoading.set(false);
      },
      error: () => this.handleError()
    });
  }

  private saveSecurity() {
    if (this.localState.securityMethod === 'NONE' || (this.localState.securityMethod === 'TOTP' && this.isTotpVerified)) {
      this.currentStep++;
      this.isLoading.set(false);
      return;
    }

    if (this.localState.securityMethod === 'EMAIL') {
      this.http.post(`${environment.apiUrl}/api/auth/2fa/activar?metodo=EMAIL`, {}).subscribe({
        next: () => {
          this.currentStep++;
          this.isLoading.set(false);
        },
        error: () => this.handleError()
      });
    }
  }

  private saveAccountType() {
    const payload = {
      tipoCuenta: this.localState.accountType,
      cif: this.localState.cif,
      nombreComercial: this.localState.nombreComercial,
      descripcion: this.localState.descripcion,
      web: this.localState.web
    };

    this.http.patch(`${environment.apiUrl}/api/usuario/me/tipo-cuenta`, payload).subscribe({
      next: () => {
        if (this.isSocialUser) {
          // Usuario de Google: refrescamos store y vamos al paso de avatar
          this.http.get<any>(`${environment.apiUrl}/api/auth/me`).subscribe(u => {
            this.authStore.setUser(u);
            this.currentStep++;
            this.isLoading.set(false);
          });
        } else {
          // Usuario de email: ahora también permitimos elegir avatar
          this.currentStep++;
          this.isLoading.set(false);
        }
      },
      error: (err) => {
        const msg = err.error?.error || 'Error al guardar datos de empresa. Revisa el CIF.';
        alert(msg);
        this.isLoading.set(false);
      }
    });
  }

  // ── avatar ────────────────────────────────────────────────────────────────────

  onAvatarFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.localState.customAvatarFile = file;
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.localState.customAvatarPreview = e.target.result;
        this.localState.avatarChoice = 'CUSTOM';
      };
      reader.readAsDataURL(file);
    }
  }

  private finish() {
    this.isLoading.set(true);

    if (this.localState.avatarChoice === 'CUSTOM' && this.localState.customAvatarFile) {
      const formData = new FormData();
      formData.append('file', this.localState.customAvatarFile);
      this.http.post<any>(`${environment.apiUrl}/api/usuario/${this.user()?.id}/avatar`, formData).subscribe({
        next: () => this.saveAvatarChoiceAndFinish(),
        error: (err) => {
          // Si falla la subida, loguear y continuar con iniciales en vez de bloquear el registro
          console.error('[Onboarding] Error subiendo avatar personalizado:', err);
          this.localState.avatarChoice = 'INITIALS';
          this.saveAvatarChoiceAndFinish();
        }
      });
    } else {
      this.saveAvatarChoiceAndFinish();
    }
  }

  private saveAvatarChoiceAndFinish() {
    const choicePayload = { choice: this.localState.avatarChoice };
    this.http.patch(`${environment.apiUrl}/api/usuario/me/avatar-choice`, choicePayload).subscribe({
      next: () => this.doCompleteOnboarding(),
      error: (err) => {
        // Si falla guardar la preferencia de avatar, continuamos igualmente (no bloqueante)
        console.warn('[Onboarding] avatar-choice patch failed, continuing anyway:', err);
        this.doCompleteOnboarding();
      }
    });
  }

  private doCompleteOnboarding() {
    this.http.post(`${environment.apiUrl}/api/usuario/me/complete-onboarding`, {}).subscribe({
      next: () => {
        const u = this.user();
        if (u) {
          u.onboardingCompletado = true;
          this.authStore.setUser(u);
        }
        this.completeOnboarding();
      },
      error: (err) => {
        // Incluso si el backend falla, cerramos el onboarding localmente para no bloquear al usuario
        console.warn('[Onboarding] complete-onboarding endpoint failed, closing locally:', err);
        const u = this.user();
        if (u) {
          u.onboardingCompletado = true;
          this.authStore.setUser(u);
        }
        this.completeOnboarding();
      }
    });
  }

  private completeOnboarding() {
    this.popupService.closeOnboarding();
    this.isLoading.set(false);
    this.router.navigate(['/']);
    window.location.reload();
  }

  // ── 2FA TOTP ──────────────────────────────────────────────────────────────────

  selectTotp() {
    this.isLoading.set(true);
    this.http.post<any>(`${environment.apiUrl}/api/auth/2fa/generar-secreto`, {}).subscribe({
      next: (data) => {
        this.totpData = data;
        this.showTotpConfig = true;
        this.localState.securityMethod = 'TOTP';
        this.isLoading.set(false);
      },
      error: () => this.handleError('Error al generar el secreto TOTP.')
    });
  }

  verifyTotp() {
    this.isLoading.set(true);
    const payload = { token: this.localState.totpCode };
    this.http.post<any>(`${environment.apiUrl}/api/auth/2fa/verificar`, payload).subscribe({
      next: (res) => {
        if (res.verified) {
          this.isTotpVerified = true;
          this.showTotpConfig = false;
          alert('¡Verificación TOTP activada correctamente!');
        } else {
          alert('Código incorrecto. Inténtalo de nuevo.');
        }
        this.isLoading.set(false);
      },
      error: () => this.handleError('Error al verificar el código TOTP.')
    });
  }

  private handleError(message = 'Ocurrió un error al guardar tus preferencias. Por favor, inténtalo de nuevo.') {
    this.isLoading.set(false);
    alert(message);
  }
}
