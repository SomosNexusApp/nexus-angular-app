import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { JwtService } from '../auth/jwt-service';
import { environment } from '../../../environments/environment';

// interceptor que añade el token JWT a todas las peticiones HTTP que van al backend
// Angular lo aplica automaticamente a todos los HttpClient.get/post/etc
@Injectable()
export class JwtInterceptor implements HttpInterceptor {
  constructor(private jwtService: JwtService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // comprobamos si la peticion va dirigida a rutas de admin (usa un token diferente)
    // IMPORTANTE: /api/auth/* son rutas de autenticación de usuario (me, 2fa, etc.),
    // NO son rutas de admin, así que NO deben usar el admin token.
    const isAdminRequest = req.url.includes('/api/admin/') || 
                           req.url.includes('/admin/');
    const token = this.jwtService.getToken(isAdminRequest);
    
    // si la url empieza por http y NO es nuestra api, es externa (ej: Stripe, Google)
    // en ese caso NO añadimos nuestro JWT para no exponer el token a terceros
    const isExternal = req.url.startsWith('http') && !req.url.startsWith(environment.apiUrl);
    const isInternal = !isExternal;

    if (token && !this.jwtService.isValid(isAdminRequest)) {
      // si el token existe pero está caducado, lo limpiamos del storage
      // la proxima peticion ya irá sin token y el backend devolverá 401
      this.jwtService.removeToken(isAdminRequest);
    } else if (token && isInternal) {
      // añadimos el Bearer token a la cabecera Authorization
      req = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
        },
      });
    }

    return next.handle(req);
  }
}
