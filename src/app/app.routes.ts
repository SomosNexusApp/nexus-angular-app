import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';
import { guestGuard } from './core/guards/guest-guard';

// todas las rutas de la app. usamos lazy loading (loadComponent) para que cada pagina
// cargue su codigo solo cuando el usuario la visita. esto hace la carga inicial mucho mas rapida.
//
// los guards que usamos:
// - authGuard: redirige al popup de registro si el usuario no esta logueado
// - guestGuard: redirige al home si el usuario Ya esta logueado (ej: no tiene sentido ir a /login si ya estas dentro)
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/home/home.component').then((m) => m.HomeComponent),
  },

  // Auth
  {
    path: 'login',
    loadComponent: () =>
      import('./components/auth/login/login.component').then((m) => m.LoginComponent),
    canActivate: [guestGuard],
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./components/auth/register/register.component').then((m) => m.RegisterComponent),
    canActivate: [guestGuard],
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./components/auth/forgot-password/forgot-password.component').then(
        (m) => m.ForgotPasswordComponent,
      ),
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./components/auth/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent,
      ),
  },
  {
    path: 'verify-email',
    loadComponent: () =>
      import('./components/auth/verify-email/verify-email.component').then(
        (m) => m.VerifyEmailComponent,
      ),
  },

  // // Public
  {
    path: 'search',
    loadComponent: () =>
      import('./components/search/search.component').then((m) => m.SearchComponent),
  },
  // {
  //   path: 'categorias/:slug',
  //   loadComponent: () =>
  //     import('./components/categorias/categoria-detail/categoria-detail.component').then(
  //       (m) => m.CategoriaDetailComponent,
  //     ),
  // },
  {
    path: 'productos/:slug',
    loadComponent: () =>
      import('./shared/components/marketplace/producto-detail/producto-detail.component').then(
        (m) => m.ProductoDetailComponent,
      ),
  },
  {
    path: 'ofertas/:slug',
    loadComponent: () =>
      import('./components/ofertas/oferta-detail/oferta-detail.component').then(
        (m) => m.OfertaDetailComponent,
      ),
  },
  {
    path: 'vehiculos',
    loadComponent: () =>
      import('./components/vehiculos/vehiculos.component').then((m) => m.VehiculosComponent),
  },
  {
    path: 'vehiculos/:slug',
    loadComponent: () =>
      import('./components/vehiculos/vehiculo-detail/vehiculo-detail.component').then(
        (m) => m.VehiculoDetailComponent,
      ),
  },

  {
    path: 'publicar',
    loadComponent: () =>
      import('./components/marketplace/publish-producto/publish-producto.component').then(
        (m) => m.PublishProductoComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'publicar/editar/:id',
    loadComponent: () =>
      import('./components/marketplace/publish-producto/publish-producto.component').then(
        (m) => m.PublishProductoComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'publicar/oferta',
    loadComponent: () =>
      import('./components/marketplace/publish-oferta/publish-oferta.component').then(
        (m) => m.PublishOfertaComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'publicar/oferta/editar/:id',
    loadComponent: () =>
      import('./components/marketplace/publish-oferta/publish-oferta.component').then(
        (m) => m.PublishOfertaComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'publicar/vehiculo',
    loadComponent: () =>
      import('./components/marketplace/publish-vehiculo/publish-vehiculo.component').then(
        (m) => m.PublishVehiculoComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'publicar/vehiculo/editar/:id',
    loadComponent: () =>
      import('./components/marketplace/publish-vehiculo/publish-vehiculo.component').then(
        (m) => m.PublishVehiculoComponent,
      ),
    canActivate: [authGuard],
  },

  {
    path: 'compras/mis-compras',
    loadComponent: () =>
      import('./components/compras/mis-compras/mis-compras.component').then(
        (m) => m.MisComprasComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'compras/:id',
    loadComponent: () =>
      import('./components/compras/compra-detail/compra-detail.component').then(
        (m) => m.CompraDetailComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'devoluciones/nueva/:compraId',
    loadComponent: () =>
      import('./components/devoluciones/nueva-devolucion/nueva-devolucion.component').then(
        (m) => m.NuevaDevolucionComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'devoluciones/:id',
    loadComponent: () =>
      import('./components/devoluciones/devolucion-detail/devolucion-detail.component').then(
        (m) => m.DevolucionDetailComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'mensajes',
    loadComponent: () =>
      import('./components/mensajes/mensajes-container/mensajes-container').then(
        (m) => m.MensajesContainerComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'notificaciones',
    loadComponent: () =>
      import('./components/notificaciones/notificaciones').then((m) => m.NotificacionesComponent),
    canActivate: [authGuard],
  },
  // {
  //   path: 'mensajes',
  //   loadComponent: () =>
  //     import('./components/mensajes/conversaciones-list/conversaciones-list.component').then(
  //       (m) => m.ConversacionesListComponent,
  //     ),
  //   canActivate: [authGuard],
  // },

  // Perfiles
  {
    path: 'perfil',
    loadComponent: () =>
      import('./components/perfil/mi-cuenta/mi-cuenta.component').then((m) => m.MiCuentaComponent),
    canActivate: [authGuard],
  },
  {
    path: 'publicidad/contratos',
    loadComponent: () =>
      import('./components/publicidad/empresa-contratos-page.component').then(
        (m) => m.EmpresaContratosPageComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'publicidad/patrocinios',
    loadComponent: () =>
      import('./components/publicidad/mis-patrocinios-page.component').then(
        (m) => m.MisPatrociniosPageComponent,
      ),
    canActivate: [authGuard],
  },

  {
    path: 'perfil/:username',
    loadComponent: () =>
      import('./components/perfil/perfil-publico/perfil-publico.component').then(
        (m) => m.PerfilPublicoComponent,
      ),
  },
  {
    path: 'mobile/favoritos',
    loadComponent: () =>
      import('./mobile/mobile-favoritos/mobile-favoritos').then((m) => m.MobileFavoritosComponent),
    canActivate: [authGuard],
  },
  {
    path: 'configuracion',
    loadComponent: () =>
      import('./components/perfil/configuracion/configuracion.component').then(
        (m) => m.ConfiguracionComponent,
      ),
    canActivate: [authGuard],
  },

  // Legal
  {
    path: 'darse-baja',
    loadComponent: () =>
      import('./components/newsletter/darse-baja/darse-baja.component').then(
        (m) => m.DarseBajaComponent,
      ),
  },

  // Compras / Checkout
  {
    path: 'checkout/:slug',
    loadComponent: () =>
      import('./components/compras/checkout/checkout.component').then((m) => m.CheckoutComponent),
    canActivate: [authGuard],
  },
  {
    path: 'compras/:id/confirmacion',
    loadComponent: () =>
      import('./components/compras/confirmacion/confirmacion.component').then(
        (m) => m.ConfirmacionComponent,
      ),
    canActivate: [authGuard],
  },

  {
    path: 'compras/:compraId/enviar',
    loadComponent: () =>
      import('./components/compras/enviar-pedido/enviar-pedido.component').then(
        (m) => m.EnviarPedidoComponent,
      ),
    canActivate: [authGuard],
  },

  // Marketplace Secciones
  {
    path: 'ofertas',
    loadComponent: () =>
      import('./components/ofertas/ofertas-flash/ofertas-flash.component').then(
        (m) => m.OfertasFlashComponent,
      ),
  },
  {
    path: 'cerca',
    loadComponent: () =>
      import('./components/marketplace/cerca-de-ti/cerca-de-ti.component').then(
        (m) => m.CercaDeTiComponent,
      ),
  },
  {
    path: 'gratis',
    loadComponent: () =>
      import('./components/marketplace/ofertas-gratis/ofertas-gratis.component').then(
        (m) => m.OfertasGratisComponent,
      ),
  },
  {
    path: 'viajes',
    loadComponent: () =>
      import('./components/marketplace/viajes/viajes-portal.component').then(
        (m) => m.ViajesPortalComponent,
      ),
  },

  {
    path: 'denegado',
    loadComponent: () =>
      import('./components/errors/forbidden/forbidden.component').then((m) => m.ForbiddenComponent),
  },
  {
    path: 'not-found',
    loadComponent: () =>
      import('./components/errors/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
  // Wildcard (404 / Redirect)
  {
    path: '**',
    loadComponent: () =>
      import('./components/errors/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
];
