import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, of, tap, switchMap, map } from 'rxjs';
import { environment } from '../../../environments/environment';

import { JwtService } from './jwt-service';
import { AuthStore } from './auth-store';
import { GuestPopupService } from '../services/guest-popup.service';

import { AuthResponse, RegisterRequest, LoginRequest } from '../../models/auth.model';
import { Usuario } from '../../models/usuario.model';

// servicio principal de autenticacion del frontend
// centraliza todo: login, registro, logout, OAuth (Google), 2FA y recuperacion de contraseña
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private jwt = inject(JwtService);
  private store = inject(AuthStore);
  private router = inject(Router);
  private guestPopup = inject(GuestPopupService);

  // tenemos dos urls base: /auth (legacy) y /api/auth (nueva)
  // ambas apuntan al mismo controlador del backend, pero las mantenemos por compatibilidad
  private readonly AUTH_URL = `${environment.apiUrl}/auth`;
  private readonly API_AUTH_URL = `${environment.apiUrl}/api/auth`;

  /**
   * LOGIN: manda las credenciales al backend y gestiona la respuesta
   * si el usuario tiene 2FA activado, devuelve requires2FA=true y el cliente debe verificar el codigo
   * si el login es directo (sin 2FA), guarda el token y carga el usuario completo
   */
  login(
    credenciales: LoginRequest & { captchaToken?: string },
    isAdmin = false,
  ): Observable<AuthResponse> {
    const payload = {
      user: credenciales.email || credenciales.username, // acepta tanto email como username
      password: credenciales.password,
      captchaToken: credenciales.captchaToken || 'token-omitido-en-dev', // evitamos error si no hay captcha
    };

    const baseUrl = isAdmin ? this.API_AUTH_URL : this.AUTH_URL;
    return this.http.post<AuthResponse>(`${baseUrl}/login`, payload).pipe(
      switchMap((response) => {
        // si requiere 2FA simplemente devolvemos la respuesta y dejamos al componente gestionarlo
        if (response.requires2FA || (response as any).requiere2FA) {
          return of(response);
        }

        // login directo: guardamos el token y cargamos el perfil completo del usuario
        this.jwt.saveToken(response.token, isAdmin);
        return this.loadCurrentUser(isAdmin).pipe(
          map((usuario) => {
            if (!isAdmin) {
              this.guestPopup.closePopup();
              // si es usuario nuevo (onboarding no completado), mostramos el asistente de bienvenida
              if (!usuario.onboardingCompletado) {
                this.guestPopup.showOnboarding();
              }
            }
            return { ...response, usuario };
          }),
        );
      }),
    );
  }

  /**
   * LOAD CURRENT USER
   */
  loadCurrentUser(isAdmin = false): Observable<Usuario> {
    const url = isAdmin ? `${this.API_AUTH_URL}/me` : `${this.AUTH_URL}/me`;
    return this.http.get<Usuario>(url).pipe(
      tap((usuario) => {
        if (isAdmin) this.store.setAdminUser(usuario);
        else this.store.setUser(usuario);
      }),
    );
  }

  /**
   * REGISTRO
   */
  register(data: RegisterRequest): Observable<any> {
    return this.http.post<any>(`${this.API_AUTH_URL}/register`, data).pipe(
      tap(() => {
        this.guestPopup.closePopup(); // CORRECCIÓN: Método sincronizado
      }),
    );
  }

  /**
   * LOGOUT
   */
  logout(isAdmin = false): void {
    this.jwt.removeToken(isAdmin);
    // Restaurar el overflow del body por si venía del menú móvil
    document.body.style.overflow = '';
    if (isAdmin) {
      this.store.clearAdmin();
      this.router.navigate(['/admin/login'], { replaceUrl: true });
    } else {
      this.store.clear();
      this.router.navigate(['/'], { replaceUrl: true });
    }
  }

  /**
   * VALIDACIONES EN TIEMPO REAL
   */
  checkEmail(email: string): Observable<boolean> {
    return this.http
      .get<{ disponible: boolean }>(`${this.API_AUTH_URL}/check-email`, { params: { email } })
      .pipe(map((res) => res.disponible));
  }

  checkUsername(username: string): Observable<boolean> {
    return this.http
      .get<{ disponible: boolean }>(`${this.API_AUTH_URL}/check-username`, { params: { username } })
      .pipe(map((res) => res.disponible));
  }

  /**
   * OAUTH
   */
  googleLogin(credential: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.AUTH_URL}/google`, { token: credential })
      .pipe(switchMap((response) => this.procesarLoginExitoso(response)));
  }

  /**
   * RECUPERACIÓN DE CONTRASEÑA
   */
  requestPasswordReset(
    email: string,
    captchaToken: string = 'token-omitido-en-dev',
  ): Observable<void> {
    return this.http.post<void>(`${this.AUTH_URL}/forgot-password`, { email, captchaToken });
  }

  resetPassword(token: string, newPassword: string): Observable<void> {
    return this.http.post<void>(`${this.AUTH_URL}/reset-password`, {
      token,
      nuevaPassword: newPassword,
    });
  }

  verifyEmail(email: string, codigo: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/auth/verificar`, { email, codigo }).pipe(
      tap((res: any) => {
        // Si el backend nos manda el token, logueamos al usuario en el acto
        if (res && res.token) {
          this.jwt.saveToken(res.token);

          this.store.setUser({
            id: res.userId,
            user: res.username,
            rol: res.rol,
            ...res,
          });
        }
      }),
    );
  }

  /**
   * helper para procesar el login exitoso de OAuth (Google)
   * guarda el token, carga el usuario y muestra el onboarding si es la primera vez
   */
  procesarLoginExitoso(response: AuthResponse): Observable<AuthResponse> {
    this.jwt.saveToken(response.token);
    return this.loadCurrentUser().pipe(
      map((usuario) => {
        if (!usuario.onboardingCompletado) {
          // Primero mostramos el onboarding, luego cerramos el popup de registro
          // para evitar que el closePopup tape el onboarding antes de montarse
          this.guestPopup.showOnboarding();
          setTimeout(() => this.guestPopup.closePopup(), 50);
        } else {
          this.guestPopup.closePopup();
        }
        return { ...response, usuario };
      }),
    );
  }

  /**
   * Versión para el componente de login cuando ya se tiene el token (ej: 2FA o OAuth manual)
   */
  procesarTokenSuccess(token: string): Observable<Usuario> {
    this.jwt.saveToken(token);
    return this.loadCurrentUser().pipe(tap(() => this.guestPopup.closePopup()));
  }

  /**
   * VERIFICAR 2FA
   */
  verify2FA(username: string, code: string, isAdmin = false): Observable<AuthResponse> {
    const baseUrl = isAdmin ? this.API_AUTH_URL : this.AUTH_URL;
    return this.http.post<AuthResponse>(`${baseUrl}/verify-2fa`, { username, code }).pipe(
      tap((response) => {
        this.jwt.saveToken(response.token, isAdmin);
      }),
      switchMap((response) =>
        this.loadCurrentUser(isAdmin).pipe(map((usuario) => ({ ...response, usuario }))),
      ),
    );
  }
}
