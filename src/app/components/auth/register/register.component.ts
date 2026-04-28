import { Component, inject, signal, ViewChild, DestroyRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors,
  AsyncValidatorFn,
} from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { RecaptchaModule, RecaptchaComponent } from 'ng-recaptcha';
import { map, catchError, delay, switchMap, timer, Observable, of } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { environment } from '../../../../environments/environment';
import { GoogleAuthService } from '../../../core/auth/google-auth.service';
import { GuestPopupService } from '../../../core/services/guest-popup.service';

// Validador asíncrono para email único
export function emailAvailableValidator(authService: AuthService): AsyncValidatorFn {
  return (control: AbstractControl): Observable<ValidationErrors | null> => {
    if (!control.value) return of(null);
    return timer(500).pipe(
      switchMap(() => authService.checkEmail(control.value)),
      map((isAvailable) => (isAvailable ? null : { emailTaken: true })),
      catchError(() => of(null)), // No bloqueamos si hay error de red
    );
  };
}

// Validador para confirmar contraseña
export function matchPasswordValidator(passwordKey: string) {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.parent) return null;
    const password = control.parent.get(passwordKey)?.value;
    return password === control.value ? null : { mismatch: true };
  };
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, RecaptchaModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css'],
})
export class RegisterComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private googleAuth = inject(GoogleAuthService);
  private guestPopup = inject(GuestPopupService);

  ngOnInit() {
    this.googleAuth.initGoogleSignIn();
    setTimeout(() => this.googleAuth.renderGoogleButton('google-btn-container'), 100);
    this.registerForm.get('password')?.valueChanges.subscribe((val) => {
      this.calculatePasswordStrength(val || '');
      this.registerForm.get('confirmar')?.updateValueAndValidity();
    });
  }

  abrirConfiguracion2FA() {
    // Tras configurar 2FA, abrimos el stepper de onboarding para completar el perfil
    this.guestPopup.showTwoFactorPopup();
    this.router.navigate(['/']);
  }

  finalizarEIrATipoCuenta() {
    // Si el usuario salta el 2FA, abrimos igualmente el onboarding (términos, seguridad, tipo cuenta)
    this.guestPopup.showOnboarding();
    this.router.navigate(['/']);
  }

  @ViewChild('captchaRef') captchaRef!: RecaptchaComponent;
  siteKey = environment.recaptchaSiteKey;

  // Estados gestionados con Signals
  step = signal<number>(1);
  emailParaVerificar = signal<string>('');
  showGdprInfo = signal<boolean>(false);
  passwordStrength = signal<number>(0);
  isOAuthMode = signal<boolean>(false);
  isLoading = signal<boolean>(false);

  // Formulario principal
  registerForm: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    apellidos: ['', [Validators.required]],
    email: [
      '',
      [Validators.required, Validators.email],
      [emailAvailableValidator(this.authService)],
    ],
    password: [
      '',
      [Validators.required, Validators.minLength(8), Validators.pattern(/^(?=.*[A-Z])(?=.*\d).+$/)],
    ],
    confirmar: ['', [Validators.required, matchPasswordValidator('password')]],
    terminosAceptados: [false, Validators.requiredTrue],
    newsletterSuscrito: [false],
  });

  // Formulario de verificación
  verifyForm: FormGroup = this.fb.group({
    codigo: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
  });

  constructor() {
    // Actualizar fortaleza de contraseña en tiempo real
    this.registerForm.get('password')?.valueChanges.subscribe((val) => {
      this.calculatePasswordStrength(val || '');
      this.registerForm.get('confirmar')?.updateValueAndValidity();
    });
  }

  // --- UI Helpers ---
  get f() {
    return this.registerForm.controls;
  }

  get emailState(): 'valid' | 'invalid' | 'pending' | 'none' {
    const ctrl = this.f['email'];
    if (ctrl.pending) return 'pending';
    if (ctrl.valid && ctrl.dirty) return 'valid';
    if (ctrl.invalid && ctrl.touched) return 'invalid';
    return 'none';
  }

  calculatePasswordStrength(password: string) {
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (password.match(/[A-Z]/)) strength += 25;
    if (password.match(/\d/)) strength += 25;
    if (password.match(/[^a-zA-Z\d]/)) strength += 25;
    this.passwordStrength.set(strength);
  }

  toggleGdpr() {
    this.showGdprInfo.update((v) => !v);
  }

  // --- OAuth ---
  async continuarConGoogle() {
    this.isLoading.set(true);
    try {
      await this.googleAuth.promptGoogleSignIn();
      this.isLoading.set(false);
    } catch (err) {
      this.isLoading.set(false);
    }
  }

  // --- Submits y Flujo ---
  onSubmit() {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }
    this.isLoading.set(true);

    // Bypass reCAPTCHA on mobile devices as requested
    if (window.innerWidth <= 768) {
      this.onCaptchaResolved('mobile-bypass');
    } else {
      this.captchaRef.execute(); // Invoca el captcha invisible
    }
  }

  onCaptchaResolved(captchaToken: string | null) {
    if (!captchaToken) {
      this.isLoading.set(false);
      return;
    }

    const val = this.registerForm.value;

    // Generamos un username a partir del email (ej. jose@gmail.com -> jose)
    const generatedUsername = val.email.split('@')[0];

    const request = {
      nombre: val.nombre,
      apellidos: val.apellidos,
      email: val.email,
      username: generatedUsername, // <--- SOLUCIÓN AL ERROR AQUÍ
      password: val.password,
      terminosAceptados: val.terminosAceptados,
      newsletterSuscrito: val.newsletterSuscrito,
      captchaToken: captchaToken,
    };

    this.authService.register(request).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.emailParaVerificar.set(request.email);
        localStorage.setItem('email_verificacion', request.email);
        this.step.set(2);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: () => {
        this.isLoading.set(false);
        this.captchaRef.reset();
      },
    });
  }

  onVerifySubmit() {
    if (this.verifyForm.invalid) return;
    this.isLoading.set(true);

    const codigo = this.verifyForm.value.codigo;
    const email = this.emailParaVerificar(); // Obtenemos el email guardado en el paso 1

    // Le pasamos los 2 argumentos: email y código
    this.authService.verifyEmail(email, codigo).subscribe({
      next: () => {
        this.isLoading.set(false);
        // Saltamos el paso 3 (2FA del register) y abrimos el onboarding completo
        this.guestPopup.showOnboarding();
        setTimeout(() => this.guestPopup.closePopup(), 50);
      },
      error: () => this.isLoading.set(false),
    });
  }

  finalizarRegistro() {
    this.guestPopup.closePopup();
  }
}
