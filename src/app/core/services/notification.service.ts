import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { WebSocketService, Notificacion } from './websocket.service';
import { ToastService, Toast } from './toast.service';
import { AuthStore } from '../auth/auth-store';
import { UiService } from './ui.service';
import { environment } from '../../../environments/environment';

export interface NotificacionInAppDto {
  id: number;
  titulo: string;
  mensaje: string;
  fecha: string;
  leida: boolean;
  tipo: string;
  url?: string;
  destacada?: boolean;
  metadata?: string;
}

// servicio de notificaciones in-app: gestiona el contador de no leidas y las muestra como toasts
// se inicializa cuando el usuario hace login y se suscribe al websocket para notificaciones en tiempo real
@Injectable({ providedIn: 'root' })
export class NotificationService {
  // signal para el contador de no leidas (actualiza el badge del campana en tiempo real)
  private readonly unread = signal(0);
  private ws = inject(WebSocketService);
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  private auth = inject(AuthStore);
  private ui = inject(UiService);

  readonly unreadCount = this.unread.asReadonly(); // solo lectura para los componentes

  private apiUrl = `${environment.apiUrl}/api/notificaciones`;
  private inited = false; // flag para no inicializar dos veces si se llama a init() de nuevo

  // flag temporal para animar la campana en el header
  newNotifTrigger = signal(false);

  // para evitar spam de notificaciones de chat si ya hemos avisado de esa sala
  private notifiedRoomIds = new Set<string>();

  // inicializa el servicio: carga el conteo inicial y se suscribe al websocket
  // se llama desde el componente raiz despues del login
  init(): void {
    if (this.inited) return; // ya inicializado, evitamos doble suscripcion
    const user = this.auth.user();
    if (!user) return;

    this.inited = true;
    this.refreshUnreadCount(); // conteo inicial desde la api

    // solicitamos permiso para notificaciones de escritorio
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // escuchamos el websocket para actualizar el conteo y mostrar toast cuando llega una nueva notif
    this.ws.notificaciones.subscribe((raw) => {
      const notif = raw as Notificacion & Partial<NotificacionInAppDto> & { metadata?: string };
      if (notif.id != null && notif.titulo) {
        // Solo incrementamos el contador general si NO es un mensaje de chat
        // (los mensajes tienen su propio contador en el icono de chat)
        if (notif.tipo !== 'NUEVO_MENSAJE' && notif.tipo !== 'OFERTA_CHAT') {
          this.unread.update((n) => n + 1);
        }
        
        this.triggerBadgeAnimation();

        // Lógica de supresión de notificaciones de chat redundantes
        if (notif.tipo === 'NUEVO_MENSAJE' || notif.tipo === 'OFERTA_CHAT') {
          const meta = notif.metadata ? JSON.parse(notif.metadata) : null;
          const roomId = meta?.roomId;
          
          // 1. Si estoy dentro de ese chat, no mostramos toast ni notif push
          if (roomId && roomId === this.ui.activeChatRoomId()) {
            return;
          }
          
          // 2. Si ya he notificado de este chat en esta sesión, no repetimos (solo el "primer" mensaje)
          if (roomId && this.notifiedRoomIds.has(roomId)) {
            return;
          }
          
          if (roomId) this.notifiedRoomIds.add(roomId);
        }

        this.showToast(notif as Notificacion); // mostramos el toast en pantalla
        this.showBrowserNotification(notif);
      }
    });
  }

  /**
   * Limpia el rastro de notificaciones enviadas para una sala.
   * Se llama cuando el usuario entra en el chat para que, si sale y le vuelven a escribir,
   * vuelva a recibir un aviso (el "primer" mensaje de nuevo).
   */
  resetChatNotification(roomId: string): void {
    this.notifiedRoomIds.delete(roomId);
  }

  private triggerBadgeAnimation() {
    this.newNotifTrigger.set(true);
    setTimeout(() => this.newNotifTrigger.set(false), 1000);
  }

  private showBrowserNotification(notif: Notificacion) {
    if ('Notification' in window && Notification.permission === 'granted') {
      const n = new Notification(notif.titulo, {
        body: notif.mensaje,
        icon: '/favicon.ico', // o el logo
      });
      n.onclick = () => {
        window.focus();
        if (notif.url) window.location.href = notif.url;
      };
    }
  }

  reset(): void {
    this.inited = false;
    this.unread.set(0);
  }

  refreshUnreadCount(): void {
    const user = this.auth.user();
    if (!user) return;
    this.http
      .get<{ noLeidas: number }>(`${this.apiUrl}/no-leidas/${user.id}`)
      .subscribe((r) => this.unread.set(r.noLeidas));
  }

  getDestacadasPendientes(): Observable<NotificacionInAppDto[]> {
    const user = this.auth.user();
    return this.http.get<NotificacionInAppDto[]>(
      `${this.apiUrl}/destacadas-pendientes/${user?.id}`,
    );
  }

  markAsRead(id: number): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}/leer`, {}).pipe(
      tap(() => {
        this.unread.update((n) => Math.max(0, n - 1));
        this.refreshUnreadCount();
      }),
    );
  }

  markAllAsRead(): Observable<void> {
    const user = this.auth.user();
    return this.http.put<void>(`${this.apiUrl}/leer-todas/${user?.id}`, {}).pipe(
      tap(() => {
        this.unread.set(0);
        this.refreshUnreadCount();
      }),
    );
  }

  toggleDestacada(id: number): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}/toggle-destacada`, {});
  }

  getAll(page = 0, filter?: string): Observable<{ content: NotificacionInAppDto[]; totalElements?: number }> {
    const user = this.auth.user();
    let url = `${this.apiUrl}/${user?.id}?page=${page}&size=20`;
    if (filter) url += `&filter=${filter}`;
    return this.http.get<{ content: NotificacionInAppDto[]; totalElements?: number }>(url);
  }

  // devuelve el icono correspondiente al tipo de notificacion (para la lista de notifs)
  private showToast(notif: Notificacion): void {
    // determinamos el tipo de toast segun el tipo de notificacion
    let toastType: Toast['tipo'] = 'info';
    const t = notif.tipo;
    if (t === 'ALERTA' || t === 'ERROR' || t === 'DEVOLUCION') {
      toastType = 'error'; // rojo
    } else if (
      t === 'NUEVA_COMPRA' ||
      t === 'COMPRA_PAGADA_VENDEDOR' ||
      t === 'COMPRA_PAGADA_COMPRADOR' ||
      t === 'COMPRA_CONFIRMADA'
    ) {
      toastType = 'success'; // verde
    } else if (
      t === 'ADVERTENCIA' ||
      t === 'CADUCIDAD_ANUNCIO' ||
      t === 'ENVIO_PLAZO' ||
      t === 'GUIA_ENVIO_VENDEDOR'
    ) {
      toastType = 'warning'; // amarillo/naranja
    } else if (t === 'FAVORITO_PRODUCTO' || t === 'FAVORITO_OFERTA') {
      toastType = 'success';
    }

    this.toast.showToast({
      tipo: toastType,
      mensaje: notif.mensaje,
      titulo: notif.titulo,
      url: notif.url,
    });
  }

  getNotifIcon(tipo: string): string {
    switch (tipo) {
      case 'NUEVA_COMPRA':
      case 'COMPRA_PAGADA_VENDEDOR':
      case 'COMPRA_PAGADA_COMPRADOR':
      case 'COMPRA_CONFIRMADA':
        return 'fas fa-shopping-bag';
      case 'ALERTA':
      case 'ERROR':
      case 'DEVOLUCION':
        return 'fas fa-exclamation-triangle';
      case 'ADVERTENCIA':
      case 'CADUCIDAD_ANUNCIO':
      case 'ENVIO_PLAZO':
      case 'GUIA_ENVIO_VENDEDOR':
        return 'fas fa-clock';
      case 'FAVORITO_PRODUCTO':
      case 'FAVORITO_OFERTA':
        return 'fas fa-heart';
      case 'NUEVO_MENSAJE':
      case 'OFERTA_CHAT':
      case 'MENSAJE':
        return 'fas fa-comment-alt';
      default:
        return 'fas fa-bell';
    }
  }

  getNotifColor(tipo: string): string {
    switch (tipo) {
      case 'NUEVA_COMPRA':
      case 'COMPRA_PAGADA_VENDEDOR':
      case 'COMPRA_PAGADA_COMPRADOR':
      case 'COMPRA_CONFIRMADA':
        return '#10b981'; // Success Green
      case 'ALERTA':
      case 'ERROR':
      case 'DEVOLUCION':
        return '#ef4444'; // Error Red
      case 'ADVERTENCIA':
      case 'CADUCIDAD_ANUNCIO':
      case 'ENVIO_PLAZO':
      case 'GUIA_ENVIO_VENDEDOR':
        return '#f59e0b'; // Warning Amber
      case 'FAVORITO_PRODUCTO':
      case 'FAVORITO_OFERTA':
        return '#ff4d94'; // Pink
      case 'NUEVO_MENSAJE':
      case 'OFERTA_CHAT':
      case 'MENSAJE':
        return '#6366f1'; // Nexus Blue
      default:
        return '#94a3b8'; // Muted
    }
  }

  getNotifTypeLabel(tipo: string): string {
    switch (tipo) {
      case 'NUEVA_COMPRA': return 'Venta';
      case 'COMPRA_PAGADA_VENDEDOR': return 'Pago Recibido';
      case 'COMPRA_PAGADA_COMPRADOR': return 'Pago Confirmado';
      case 'COMPRA_CONFIRMADA': return 'Transacción';
      case 'ALERTA': return 'Alerta';
      case 'ERROR': return 'Error';
      case 'DEVOLUCION': return 'Devolución';
      case 'ADVERTENCIA': return 'Aviso';
      case 'CADUCIDAD_ANUNCIO': return 'Caducidad';
      case 'ENVIO_PLAZO': return 'Envío';
      case 'GUIA_ENVIO_VENDEDOR': return 'Guía de Envío';
      case 'FAVORITO_PRODUCTO':
      case 'FAVORITO_OFERTA': return 'Favorito';
      case 'NUEVO_MENSAJE': return 'Mensaje';
      case 'OFERTA_CHAT': return 'Oferta';
      case 'MENSAJE': return 'Mensaje';
      default: return 'Notificación';
    }
  }
}
