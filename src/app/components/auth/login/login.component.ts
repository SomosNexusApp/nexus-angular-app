import { Component, inject, OnInit, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { timer, Subscription } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { GoogleAuthService } from '../../../core/auth/google-auth.service';
import { GuestPopupService } from '../../../core/services/guest-popup.service';
import { ToastService } from '../../../core/services/toast.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private googleAuth = inject(GoogleAuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private guestPopup = inject(GuestPopupService);
  private toast = inject(ToastService);
  private http = inject(HttpClient);

  step = signal<number>(1);
  isLoading = signal<boolean>(false);
  isPasswordVisible = signal<boolean>(false);
  isOAuthMode = signal<boolean>(false);

  errorMessage = signal<string | null>(null);
  resetSuccessMessage = signal<boolean>(false);
  countdown = signal<number>(0);
  private countdownSub?: Subscription;

  private tempUsername = signal<string | null>(null);      // username del usuario durante 2FA
  private tempMfaToken = signal<string | null>(null);     // token temporal mientras verifica 2FA
  twoFactorMethod = signal<'EMAIL' | 'TOTP' | null>(null); // método activo para mostrar instrucciones
  returnUrl: string = '/';

  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  twoFactorForm: FormGroup = this.fb.group({
    codigo: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
  });

  ngOnInit() {
    // Inicializar Google SDK
    this.googleAuth.initGoogleSignIn();
    setTimeout(() => this.googleAuth.renderGoogleButton('google-btn-container'), 100);
    this.route.queryParams.subscribe((params) => {
      if (params['resetOk'] === 'true') this.resetSuccessMessage.set(true);
      this.returnUrl = params['returnUrl'] || '/';
    });
  }

  ngOnDestroy() {
    this.countdownSub?.unsubscribe();
  }

  get f() {
    return this.loginForm.controls;
  }
  get f2() {
    return this.twoFactorForm.controls;
  }

  togglePasswordVisibility() {
    this.isPasswordVisible.update((v) => !v);
  }

  onSubmit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.resetSuccessMessage.set(false);

    const { email, password } = this.loginForm.value;

    this.authService.login({ email, password }).subscribe({
      next: (res: any) => {
        this.isLoading.set(false);
        if (res.requires2FA || res.requiere2FA) {
          // Guardamos el username y el token temporal para el paso 2
          this.tempUsername.set(res.username || null);
          this.tempMfaToken.set(res.mfaToken || null);
          // Detectamos el método de 2FA del actor (puede venir en la respuesta)
          this.twoFactorMethod.set(res.twoFactorMethod as any || null);
          this.step.set(2);
        } else {
          this.loginExitoso();
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.manejarError(err);
      },
    });
  }

  onTwoFactorSubmit() {
    if (this.twoFactorForm.invalid) return;
    this.isLoading.set(true);
    this.errorMessage.set(null);

    const username = this.tempUsername();
    const code = this.twoFactorForm.value.codigo;

    if (!username) {
      // Fallback: si no tenemos username, volvemos al paso 1
      this.isLoading.set(false);
      this.step.set(1);
      this.errorMessage.set('Sesión expirada. Por favor, inicia sesión de nuevo.');
      return;
    }

    const payload = { username, code };
    const url = `${environment.apiUrl}/auth/verify-2fa`;

    this.http.post<any>(url, payload).subscribe({
      next: (res) => {
        this.authService.procesarTokenSuccess(res.token).subscribe({
          next: () => {
            this.isLoading.set(false);
            this.loginExitoso();
          },
          error: () => this.isLoading.set(false)
        });
      },
      error: () => {
        this.isLoading.set(false);
        this.errorMessage.set('Código incorrecto o expirado');
      },
    });
  }

  // --- OAUTH REAL ---
  async continuarConGoogle() {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      await this.googleAuth.promptGoogleSignIn();
      // El servicio ya navega y cierra popup internamente
      this.isLoading.set(false);
    } catch (err: any) {
      this.isLoading.set(false);
      if (typeof err === 'string' && !err.includes('canceló')) {
        this.errorMessage.set(err);
      }
    }
  }

  private loginExitoso() {
    this.guestPopup.closePopup();
    this.router.navigateByUrl(this.returnUrl);
  }

  private manejarError(err: any) {
    if (err.status === 401) {
      this.errorMessage.set('Email o contraseña incorrectos');
    } else if (err.status === 429) {
      this.iniciarCountdown();
    } else if (err.status === 403) {
      this.errorMessage.set(err.error?.error || 'Cuenta suspendida o eliminada');
    } else {
      this.errorMessage.set('Error interno. Inténtalo más tarde.');
    }
  }

  private iniciarCountdown() {
    this.countdown.set(60);
    this.errorMessage.set(`Demasiados intentos. Espera ${this.countdown()} segundos.`);
    this.countdownSub?.unsubscribe();
    this.countdownSub = timer(1000, 1000).subscribe(() => {
      this.countdown.update((c) => c - 1);
      this.errorMessage.set(`Demasiados intentos. Espera ${this.countdown()} segundos.`);
      if (this.countdown() <= 0) {
        this.errorMessage.set(null);
        this.countdownSub?.unsubscribe();
      }
    });
  }
}
