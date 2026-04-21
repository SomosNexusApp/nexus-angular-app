import { Component, OnInit, AfterViewInit, OnDestroy, signal, ElementRef, Input } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthStore } from '../../../core/auth/auth-store';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastContainerComponent } from '../../../shared/components/toast-container/toast-container.component';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { ToastService } from '../../../core/services/toast.service';
import { ViewChild } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';

import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';

@Component({
  selector: 'app-configuracion',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    ToastContainerComponent, 
    ConfirmModalComponent,
    AvatarComponent
  ],
  templateUrl: './configuracion.component.html',
  styleUrls: ['./configuracion.component.css'],
})
export class ConfiguracionComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() isEmbedded = false;
  private observer: IntersectionObserver | null = null;
  activeSection = signal<string>('perfil');
  private backendUrl = environment.apiUrl;
  sugerenciasUbicacion = signal<any[]>([]);
  private searchSubject = new Subject<string>();
  // Variables 2FA
  show2FASetup = signal(false);
  qrCodeUrl = signal<string | null>(null);
  totpCode = '';
  loading2FA = signal(false);

  // Secciones del scrollspy
  sections = [
    { id: 'perfil', icon: 'fas fa-user-edit', title: 'Datos del Perfil' },
    { id: 'privacidad', icon: 'fas fa-user-secret', title: 'Privacidad' },
    { id: 'cuenta', icon: 'fas fa-briefcase', title: 'Tipo de Cuenta' },
    { id: 'seguridad', icon: 'fas fa-shield-alt', title: 'Seguridad' },
    { id: 'notificaciones', icon: 'fas fa-bell', title: 'Notificaciones' },
    { id: 'gdpr', icon: 'fas fa-file-invoice', title: 'Datos y Privacidad' },
  ];

  user: any;

  editPerfil = signal({
    nombre: '',
    apellidos: '',
    biografia: '',
    ubicacion: '',
    telefono: '',
  });

  privacidad = signal({
    mostrarUbicacion: true,
    mostrarTelefono: false,
    permitirMensajesDesconocidos: true,
  });

  showFormEmpresa = signal(false);
  datosEmpresa = signal({
    cif: '',
    web: '',
    telefonoEmpresa: '',
  });

  notificaciones = signal({
    notifNuevosMensajes: true,
    notifNuevaCompra: true,
    notifValoracion: true,
    notifOfertas: true,
    notifEnvios: true,
    notifNovedades: true,
    newsletterSuscrito: false,
  });

  security = signal({
    passwordActual: '',
    passwordNueva: '',
    passwordConfirm: '',
  });

  // Modales
  showModalEmpresa = signal(false);
  showDeleteModal = signal(false);
  deleteAccount = signal({ confirmText: '', password: '' });

  @ViewChild('disable2FAModal') disable2FAModal!: ConfirmModalComponent;
  @ViewChild('enableEmail2FAModal') enableEmail2FAModal!: ConfirmModalComponent;



  constructor(
    private authStore: AuthStore,
    private authService: AuthService,
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
    private toast: ToastService,
    private el: ElementRef
  ) {
    this.user = this.authStore.user;
  }

  ngOnInit(): void {
    if (!this.user()) {
      this.router.navigate(['/auth/login']);
      return;
    }
    this.cargarDatosActuales();


    this.searchSubject
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
        switchMap((query) => {
          if (!query || query.length < 3) {
            this.sugerenciasUbicacion.set([]);
            return [];
          }
          const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&countrycodes=es&limit=5`;
          return this.http.get<any[]>(url);
        }),
      )
      .subscribe({
        next: (res) => this.sugerenciasUbicacion.set(res || []),
        error: () => this.sugerenciasUbicacion.set([]),
      });

    this.route.fragment.subscribe(frag => {
      if (frag) {
        this.scrollToSection(frag);
      }
    });
  }

  ngAfterViewInit(): void {
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        this.initScrollSpy();
        this.checkFragmentAndScroll();
      }, 100);
    }
  }

  private checkFragmentAndScroll() {
    const fragment = this.route.snapshot.fragment;
    if (fragment) {
      setTimeout(() => this.scrollToSection(fragment), 300);
    }
  }

  ngOnDestroy(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  private initScrollSpy() {
    if (this.observer) this.observer.disconnect();

    const options = {
      root: null,
      rootMargin: '-150px 0px -80% 0px', // Activa cuando la sección llega a la parte superior (considerando el header)
      threshold: 0
    };

    this.observer = new IntersectionObserver((entries) => {
      // Filtramos solo las que están entrando en la zona
      const intersecting = entries.filter(e => e.isIntersecting);
      
      if (intersecting.length > 0) {
        // Si hay varias, cogemos la que esté más arriba en el viewport
        intersecting.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        this.activeSection.set(intersecting[0].target.id);
      }
    }, options);

    this.sections.forEach(sec => {
      const element = document.getElementById(sec.id);
      if (element) {
        this.observer?.observe(element);
      }
    });
  }
  onUbicacionInput(value: string) {
    this.updateEditPerfilField('ubicacion', value);
    this.searchSubject.next(value);
  }

  seleccionarUbicacion(lugar: any) {
    const formato = this.formatNominatimAddress(lugar.address);
    this.updateEditPerfilField('ubicacion', formato);
    this.sugerenciasUbicacion.set([]);
  }

  formatNominatimAddress(address: any): string {
    if (!address) return '';
    const ciudad = address.city || address.town || address.village || address.municipality || '';
    const provincia = address.province || address.state || '';
    const cp = address.postcode || '';

    let partes = [];
    if (ciudad) partes.push(ciudad);
    if (provincia && provincia !== ciudad) partes.push(provincia);

    let resultado = partes.join(', ');
    if (cp) resultado += ` (${cp})`;

    return resultado;
  }

  scrollToSection(id: string) {
    this.activeSection.set(id);
    const element = document.getElementById(id);
    if (element) {
      const y = element.getBoundingClientRect().top + window.scrollY - 150;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }

  cargarDatosActuales() {
    const u = this.user();
    if (!u) return;

    this.editPerfil.set({
      nombre: u.nombre || '',
      apellidos: u.apellidos || '',
      biografia: u.biografia || '',
      ubicacion: u.ubicacion || '',
      telefono: u.telefono || '',
    });

    this.privacidad.set({
      mostrarUbicacion: u.mostrarUbicacion ?? true,
      mostrarTelefono: u.mostrarTelefono ?? false,
      permitirMensajesDesconocidos:
        typeof (u as any).permitirMensajesDesconocidos === 'boolean'
          ? (u as any).permitirMensajesDesconocidos
          : true,
    });

    this.notificaciones.set({
      notifNuevosMensajes:
        typeof (u as any).notifNuevosMensajes === 'boolean' ? (u as any).notifNuevosMensajes : true,
      notifNuevaCompra:
        typeof (u as any).notifNuevaCompra === 'boolean' ? (u as any).notifNuevaCompra : true,
      notifValoracion:
        typeof (u as any).notifValoracion === 'boolean' ? (u as any).notifValoracion : true,
      notifOfertas: typeof (u as any).notifOfertas === 'boolean' ? (u as any).notifOfertas : true,
      notifEnvios: typeof (u as any).notifEnvios === 'boolean' ? (u as any).notifEnvios : true,
      notifNovedades:
        typeof (u as any).notifNovedades === 'boolean' ? (u as any).notifNovedades : true,
      newsletterSuscrito:
        typeof (u as any).newsletterSuscrito === 'boolean' ? (u as any).newsletterSuscrito : false,
    });
  }

  onAvatarSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const u = this.user();
      if (!u) return;
      const formData = new FormData();
      formData.append('file', file);

      this.http.post<any>(`${this.backendUrl}/api/usuario/${u.id}/avatar`, formData).subscribe({
        next: () => {
          this.toast.success('Avatar actualizado correctamente');
          this.authService.loadCurrentUser().subscribe();
        },
        error: () => this.toast.error('Error al subir el avatar'),
      });
    }
  }

  setAvatarChoice(choice: 'GOOGLE' | 'INITIALS' | 'CUSTOM') {
    this.http.patch(`${this.backendUrl}/api/usuario/me/avatar-choice`, { choice }).subscribe({
      next: () => {
        this.toast.success('Preferencia de imagen actualizada');
        this.authService.loadCurrentUser().subscribe();
      },
      error: () => this.toast.error('Error al actualizar preferencia')
    });
  }

  guardarPerfil() {
    const u = this.user();
    if (!u) return;
    this.http.patch(`${this.backendUrl}/api/usuario/${u.id}`, this.editPerfil()).subscribe({
      next: () => {
        this.toast.success('Perfil actualizado');
        this.authService.loadCurrentUser().subscribe();
      },
      error: () => this.toast.error('Error guardando perfil'),
    });
  }

  usarMiUbicacion() {
    if (navigator.geolocation) {
      this.toast.info('Obteniendo ubicación...');
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`;
          this.http.get<any>(url).subscribe({
            next: (res) => {
              if (res && res.address) {
                const formato = this.formatNominatimAddress(res.address);
                this.editPerfil.update((f) => ({ ...f, ubicacion: formato }));
                this.toast.success('Ubicación obtenida');
              } else {
                this.toast.warning('No se pudo resolver la ciudad');
              }
            },
            error: () => this.toast.error('Error al conectar con mapas'),
          });
        },
        () => this.toast.error('Permiso de ubicación denegado'),
      );
    }
  }

  updatePrivacidadField(field: string, value: boolean) {
    this.privacidad.update((p: any) => ({ ...p, [field]: value }));
  }

  updateNotificacionesField(field: string, value: boolean) {
    this.notificaciones.update((n: any) => ({ ...n, [field]: value }));
  }

  updateEditPerfilField(field: string, value: string) {
    this.editPerfil.update((p: any) => ({ ...p, [field]: value }));
  }

  updateSecurityField(field: string, value: string) {
    this.security.update((s: any) => ({ ...s, [field]: value }));
  }

  updateDeleteAccountField(field: string, value: string) {
    this.deleteAccount.update((d: any) => ({ ...d, [field]: value }));
  }

  guardarPrivacidad() {
    this.http.patch(`${this.backendUrl}/api/usuario/me/privacidad`, this.privacidad()).subscribe({
      next: () => this.toast.success('Ajustes de privacidad guardados'),
      error: () => this.toast.error('Error guardando privacidad'),
    });
  }

  updateDatosEmpresaField(field: string, value: string) {
    this.datosEmpresa.update((d: any) => ({ ...d, [field]: value }));
  }

  prepararMigracionEmpresa() {
    const datos = this.datosEmpresa();
    if (!datos.cif || !datos.telefonoEmpresa) {
      this.toast.warning('El CIF y el Teléfono son obligatorios para empresas');
      return;
    }
    this.showModalEmpresa.set(true);
  }

  ejecutarMigracionEmpresa() {
    const datos = this.datosEmpresa();
    this.http
      .patch(`${this.backendUrl}/api/usuario/me/tipo-cuenta`, {
        tipoCuenta: 'EMPRESA',
        cif: datos.cif,
        web: datos.web,
        telefonoEmpresa: datos.telefonoEmpresa,
      })
      .subscribe({
        next: () => {
          this.toast.success('Cuenta migrada a Empresa. Inicia sesión de nuevo.');
          this.showModalEmpresa.set(false);
          this.showFormEmpresa.set(false);
          setTimeout(() => {
            this.authService.logout();
            this.router.navigate(['/auth/login']);
          }, 2000);
        },
        error: (err) => {
          this.showModalEmpresa.set(false);
          this.toast.error(err.error?.error || 'Error al migrar la cuenta');
        },
      });
  }

  cambiarPassword() {
    const s = this.security();
    
    // Front-end basic validation
    if (!s.passwordActual || !s.passwordNueva || !s.passwordConfirm) {
      this.toast.warning('Todos los campos son obligatorios.');
      return;
    }

    if (s.passwordNueva.length < 8) {
      this.toast.warning('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (s.passwordNueva !== s.passwordConfirm) {
      this.toast.warning('Las nuevas contraseñas no coinciden.');
      return;
    }

    this.http
      .post(`${this.backendUrl}/api/usuario/me/cambiar-password`, {
        passwordActual: s.passwordActual,
        passwordNueva: s.passwordNueva,
      })
      .subscribe({
        next: () => {
          this.toast.success('Contraseña actualizada correctamente.');
          // Limpiar campos
          this.security.set({
            passwordActual: '',
            passwordNueva: '',
            passwordConfirm: '',
          });
        },
        error: (err) => {
          const msg = err.error?.error || 'No se pudo cambiar la contraseña. Inténtalo de nuevo.';
          this.toast.error(msg);
        },
      });
  }

  toggle2FA(metodo: string) {
    if (this.loading2FA()) return;

    const isCurrentlyEnabled = this.user()?.twoFactorEnabled;
    const currentMethod = this.user()?.twoFactorMethod;

    if (isCurrentlyEnabled && currentMethod === metodo) {
      this.disable2FAModal.open();
      return;
    }

    if (metodo === 'EMAIL') {
      this.enableEmail2FAModal.open();
    }

    if (metodo === 'APP') {
      if (this.show2FASetup() && !isCurrentlyEnabled) {
        this.show2FASetup.set(false);
        this.qrCodeUrl.set(null);
        return;
      }
      this.show2FASetup.set(true);
      this.qrCodeUrl.set(null);
      this.loading2FA.set(true);
      this.http
        .post<{ qrUrl: string }>(`${this.backendUrl}/api/usuario/me/2fa/setup-app`, {})
        .subscribe({
          next: (res) => {
            this.qrCodeUrl.set(res.qrUrl);
            this.loading2FA.set(false);
          },
          error: () => {
            this.toast.error('Error al generar código QR');
            this.show2FASetup.set(false);
            this.loading2FA.set(false);
          },
        });
    }
  }

  confirmEnableEmail2FA() {
    this.loading2FA.set(true);
    this.http.post(`${this.backendUrl}/api/usuario/me/2fa/enable-email`, {}).subscribe({
      next: () => {
        this.toast.success('Autenticación por Email activada');
        this.authService.loadCurrentUser().subscribe({
          complete: () => this.loading2FA.set(false)
        });
      },
      error: () => this.loading2FA.set(false)
    });
  }

  confirmDisable2FA() {
    this.loading2FA.set(true);
    this.http.post(`${this.backendUrl}/api/usuario/me/2fa/disable`, {}).subscribe({
      next: () => {
        this.toast.success('2FA Desactivado');
        this.show2FASetup.set(false);
        this.qrCodeUrl.set(null);
        this.authService.loadCurrentUser().subscribe({
          complete: () => this.loading2FA.set(false)
        });
      },
      error: () => this.loading2FA.set(false)
    });
  }

  confirmar2FAApp() {
    if (this.totpCode.length !== 6) {
      this.toast.warning('El código debe tener 6 dígitos');
      return;
    }
    this.http
      .post(`${this.backendUrl}/api/usuario/me/2fa/enable-app`, { code: this.totpCode })
      .subscribe({
        next: () => {
          this.toast.success('Google Authenticator activado');
          this.show2FASetup.set(false);
          this.totpCode = '';
          this.authService.loadCurrentUser().subscribe();
        },
        error: (err) => this.toast.error(err.error?.error || 'Código incorrecto'),
      });
  }


  guardarNotificaciones() {
    this.http
      .patch(`${this.backendUrl}/api/usuario/me/notificaciones-config`, this.notificaciones())
      .subscribe({
        next: () => this.toast.success('Preferencias guardadas'),
        error: () => this.toast.error('Error guardando preferencias'),
      });
  }

  descargarDatos() {
    this.http.get(`${this.backendUrl}/api/usuario/me/datos-personales`).subscribe({
      next: (data) => {
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mis_datos_nexus_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.toast.success('Descarga iniciada');
      },
      error: () => this.toast.error('Error al recuperar datos'),
    });
  }

  confirmarEliminacion() {
    const u = this.user();
    const isSocial = u?.googleId || u?.facebookId;

    if (this.deleteAccount().confirmText !== 'ELIMINAR') {
      this.toast.warning("Debes escribir 'ELIMINAR' para confirmar.");
      return;
    }

    if (!isSocial && !this.deleteAccount().password) {
      this.toast.warning('La contraseña es obligatoria.');
      return;
    }

    this.http
      .delete(`${this.backendUrl}/api/usuario/me/cuenta`, {
        body: { password: this.deleteAccount().password },
      })
      .subscribe({
        next: () => {
          this.toast.success('Cuenta eliminada permanentemente');
          this.authService.logout();
          this.router.navigate(['/']);
        },
        error: (err) =>
          this.toast.error(err.error?.error || 'Contraseña incorrecta o error al eliminar'),
      });
  }
}
