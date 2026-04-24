import { ApplicationConfig, APP_INITIALIZER, inject } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, HTTP_INTERCEPTORS, withInterceptorsFromDi, withJsonpSupport } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { catchError, of, Observable, forkJoin } from 'rxjs';
import { registerLocaleData } from '@angular/common'; // <-- Añadir
import localeEs from '@angular/common/locales/es'; // <-- Añadir

import { routes } from './app.routes';

import { AuthService } from './core/auth/auth.service';
import { JwtService } from './core/auth/jwt-service';
import { JwtInterceptor } from './core/interceptors/jwt-interceptor';
import { ErrorInterceptor } from './core/interceptors/error-interceptor';

registerLocaleData(localeEs, 'es-ES');

// Factory function para el inicializador
export function initializeUserData(authService: AuthService, jwtService: JwtService) {
  return () => {
    const obs: Observable<any>[] = [];
    if (jwtService.isValid(false)) {
      obs.push(authService.loadCurrentUser(false).pipe(catchError(() => of(null))));
    }
    if (jwtService.isValid(true)) {
      obs.push(authService.loadCurrentUser(true).pipe(catchError(() => of(null))));
    }
    return obs.length > 0 ? forkJoin(obs) : of(null);
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(
      routes, 
      withComponentInputBinding(),
      withInMemoryScrolling({
        scrollPositionRestoration: 'enabled',
        anchorScrolling: 'enabled'
      })
    ),
    provideHttpClient(withInterceptorsFromDi(), withJsonpSupport()),
    provideAnimationsAsync(),

    // Interceptores
    { provide: HTTP_INTERCEPTORS, useClass: JwtInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true },

    // ⚡ Inicializador de la App (Carga el usuario antes de renderizar)
    {
      provide: APP_INITIALIZER,
      useFactory: initializeUserData,
      deps: [AuthService, JwtService],
      multi: true,
    },
  ],
};
