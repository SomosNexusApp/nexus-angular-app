import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  inject,
  signal,
  ViewChild,
  ElementRef,
  AfterViewChecked,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../../../core/services/chat.service';
import { ChatMensaje, WebSocketService } from '../../../core/services/websocket.service';
import { AuthStore } from '../../../core/auth/auth-store';
import { BloqueoService } from '../../../core/services/bloqueo.service';
import { UiService } from '../../../core/services/ui.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TimeAgoPipe } from '../../../shared/pipes/time-ago.pipe';
import { CurrencyEsPipe } from '../../../shared/pipes/currency-es.pipe';
import { CoverImagePipe } from '../../../shared/pipes/cover-image.pipe';
import { ChatInputComponent, ChatDraft } from '../chat-input/chat-input';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { ReporteModalComponent } from '../../../shared/components/reporte-modal/reporte-modal.component';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { Subscription } from 'rxjs';
import { SlugPipe } from '../../../shared/pipes/slug-pipe';
import { createFriendlySlug } from '../../../shared/utils/slug-utils';

@Component({
  selector: 'app-chat-panel',
  standalone: true,
  imports: [
    CommonModule, 
    RouterLink,
    FormsModule,
    TimeAgoPipe, 
    CurrencyEsPipe, 
    ChatInputComponent, 
    CoverImagePipe, 
    ReporteModalComponent,
    ConfirmModalComponent,
    AvatarComponent,
    SlugPipe
  ],
  templateUrl: './chat-panel.html',
  styleUrl: './chat-panel.css',
})
export class ChatPanelComponent implements OnChanges, AfterViewChecked, OnDestroy {
  @Input() conversacion: any;
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;
  @ViewChild('reporteModal') reporteModal!: ReporteModalComponent;
  @ViewChild('confirmBlockModal') confirmBlockModal!: ConfirmModalComponent;

  chatService = inject(ChatService);
  wsService = inject(WebSocketService);
  authStore = inject(AuthStore);
  bloqueoService = inject(BloqueoService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private ui = inject(UiService);
  private notificationService = inject(NotificationService);

  mensajes = signal<ChatMensaje[]>([]);
  otroUsuario = signal<any>(null);
  esVendedor = signal(false);
  cargando = signal(false);
  usuarioBloqueado = signal(false);
  showMenu = signal(false);
  mostrarOfertaModal = signal(false);
  precioOferta = signal<number | null>(null);
  puedeNegociar = signal(true);
  mensajeSeleccionado = signal<ChatMensaje | null>(null);
  private pressTimer: any;
  private isLongPress = false;
  private autoScrollActivado = true;
  private wsSub: Subscription | null = null;
  private leidosSub: Subscription | null = null;
  private recibidosSub: Subscription | null = null;
  minPrecioPermitido = signal<number>(0);
  esPrecioValido = signal(true);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['conversacion'] && this.conversacion) {
      this.cargarChat();
    }
  }

  cargarChat() {
    this.cargando.set(true);
    const currUser = this.authStore.user();
    if (!currUser || !this.conversacion) return;

    // Determinar interlocutor
    if (this.conversacion.remitente?.id === currUser.id) {
      this.otroUsuario.set(this.conversacion.receptor);
    } else {
      this.otroUsuario.set(this.conversacion.remitente);
    }

    // Identificar si el otro es el vendedor del producto
    const prod = this.conversacion.producto;
    if (prod && this.otroUsuario()) {
      const vendedorId = prod.vendedor?.id || prod.usuario?.id;
      this.esVendedor.set(vendedorId === this.otroUsuario().id);
      this.puedeNegociar.set(prod.tipoOferta === 'VENTA');
    } else {
      this.esVendedor.set(false);
      this.puedeNegociar.set(false);
    }

    const productoId = this.conversacion.producto?.id || null;
    const otroId = this.otroUsuario()?.id;
    const roomId =
      this.conversacion.roomId ||
      (productoId
        ? `P_${productoId}`
        : `D_${Math.min(currUser.id, otroId)}_${Math.max(currUser.id, otroId)}`);

    if (!roomId || !otroId) {
      this.cargando.set(false);
      return;
    }

    // Check if user is blocked
    this.bloqueoService.estaBloqueado(otroId).subscribe({
      next: (res) => this.usuarioBloqueado.set(res.bloqueado),
      error: () => this.usuarioBloqueado.set(false)
    });

    // Suscribirse al topic WebSocket de esta sala para recibir mensajes en tiempo real
    this.wsService.suscribirseAlChat(roomId);
    this.wsService.suscribirseALeidos(roomId);
    this.wsService.suscribirseARecibidos(roomId);
    this.ui.activeChatRoomId.set(roomId);
    this.notificationService.resetChatNotification(roomId);

    // Cancelar suscripción anterior al observable de mensajes
    this.wsSub?.unsubscribe();
    this.wsSub = this.wsService.mensajes.subscribe((msg: ChatMensaje) => {
      // Solo agregar si es de esta conversación y no es un duplicado
      if (msg.roomId === roomId || (msg.producto?.id === productoId && productoId !== null)) {
        // Verificar si el mensaje está oculto para mí
        const isHiddenForMe =
          (msg.remitente.id === currUser.id && msg.eliminadoParaRemitente) ||
          (msg.receptor?.id === currUser.id && msg.eliminadoParaReceptor);

        if (isHiddenForMe) return;

        const existe = this.mensajes().some((m) => m.id === msg.id);
        if (!existe) {
          // Reemplazar mensaje optimista si existe
          this.mensajes.update((msgs) => {
            const sinOptimistas = msgs.filter((m) => m.id > 0);
            return [...sinOptimistas, msg];
          });
          this.autoScrollActivado = true;

          // Si el mensaje es para mí, marcarlo como leído inmediatamente
          if (msg.receptor?.id === currUser.id) {
            this.wsService.marcarComoRecibido(roomId, currUser.id);
            this.wsService.marcarComoLeido(roomId, currUser.id);
          }
        }
      }
    });

    // Suscribirse a confirmaciones de entrega
    this.recibidosSub?.unsubscribe();
    this.recibidosSub = this.wsService.recibidos.subscribe((ev) => {
      if (ev.roomId === roomId && ev.usuarioId !== currUser.id) {
        // El OTRO ha recibido mis mensajes
        this.mensajes.update((msgs) => msgs.map((m) => {
          if (m.remitente.id === currUser.id && !m.recibido && !m.leido) {
            return { ...m, recibido: true };
          }
          return m;
        }));
      }
    });

    // Suscribirse a confirmaciones de lectura
    this.leidosSub?.unsubscribe();
    this.leidosSub = this.wsService.leidos.subscribe((ev) => {
      if (ev.roomId === roomId && ev.usuarioId !== currUser.id) {
        // El OTRO ha leído mis mensajes
        this.mensajes.update((msgs) => msgs.map((m) => {
          if (m.remitente.id === currUser.id && !m.leido) {
            // Un mensaje leído está implícitamente recibido
            return { ...m, leido: true, recibido: true };
          }
          return m;
        }));
        // Al leer, seguramente el contador de no leídos cambie
        this.wsService.refreshUnreadCount();
      }
    });

    // Marcar leídos inicial
    this.chatService.marcarLeidos(roomId, currUser.id).subscribe(() => {
      this.wsService.refreshUnreadCount();
    });
    this.wsService.marcarComoRecibido(roomId, currUser.id);
    this.wsService.marcarComoLeido(roomId, currUser.id);

    // Cargar historial
    this.chatService.getConversacion(roomId, currUser.id, otroId, currUser.id).subscribe({
      next: (msgs) => {
        // Ordenar por fecha por si acaso el backend devuelve desordenado
        this.mensajes.set(msgs.sort((a, b) => new Date(a.fechaEnvio).getTime() - new Date(b.fechaEnvio).getTime()));
        this.cargando.set(false);
        this.autoScrollActivado = true;
        
        if (this.conversacion.producto) {
          this.minPrecioPermitido.set(Math.round(this.conversacion.producto.precio * 0.8 * 100) / 100);
        }
      },
      error: () => {
        this.mensajes.set([]);
        this.cargando.set(false);
      },
    });
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  onImageLoad() {
    this.scrollToBottom(true);
  }

  private scrollToBottom(force = false): void {
    if ((this.autoScrollActivado || force) && this.scrollContainer) {
      try {
        const nativeElement = this.scrollContainer.nativeElement;
        nativeElement.scrollTop = nativeElement.scrollHeight;
        if (!force) {
          this.autoScrollActivado = false;
        }
      } catch (err) {}
    }
  }

  onScroll(event: any) {
    if (event.target.scrollTop === 0) {
      // TODO: cargar mensajes anteriores (paginación)
    }
  }

  aceptarOferta(msg: ChatMensaje) {
    this.chatService.responderPropuesta(msg.id, true).subscribe((updatedMsg) => {
      this.actualizarMensajeLista(updatedMsg);
    });
  }

  rechazarOferta(msg: ChatMensaje) {
    this.chatService.responderPropuesta(msg.id, false).subscribe((updatedMsg) => {
      this.actualizarMensajeLista(updatedMsg);
    });
  }

  toggleMenu(event: Event) {
    event.stopPropagation();
    this.showMenu.update((v) => !v);

    if (this.showMenu()) {
      // Cerrar al hacer click fuera
      const closeMenu = () => {
        this.showMenu.set(false);
        document.removeEventListener('click', closeMenu);
      };
      setTimeout(() => document.addEventListener('click', closeMenu), 0);
    }
  }

  bloquear() {
    const otro = this.otroUsuario();
    if (!otro) return;

    if (this.usuarioBloqueado()) {
      this.bloqueoService.desbloquear(otro.id).subscribe({
        next: () => {
          this.usuarioBloqueado.set(false);
          this.showMenu.set(false);
          this.toast.success('Usuario desbloqueado');
        },
        error: (err) => this.toast.error('Error al desbloquear: ' + (err.error?.error || err.message))
      });
    } else {
      this.showMenu.set(false);
      this.confirmBlockModal.open();
    }
  }

  confirmarBloqueo() {
    const otro = this.otroUsuario();
    if (!otro) return;
    
    this.bloqueoService.bloquearUsuario(otro.id, 'Bloqueado desde chat').subscribe({
      next: () => {
        this.usuarioBloqueado.set(true);
        this.toast.success('Usuario bloqueado');
      },
      error: (err) => this.toast.error('Error al bloquear: ' + (err.error?.error || err.message))
    });
  }

  reportar() {
    const otro = this.otroUsuario();
    if (!otro) return;
    this.showMenu.set(false);
    this.reporteModal.abrir('USUARIO', otro.id);
  }

  reportarProducto() {
    if (!this.conversacion.producto) return;
    this.showMenu.set(false);
    this.reporteModal.abrir('PRODUCTO', this.conversacion.producto.id);
  }

  formatTime(seconds: number): string {
    if (isNaN(seconds) || seconds === Infinity) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  toggleAudio(player: HTMLAudioElement) {
    if (player.paused) {
      player.play();
    } else {
      player.pause();
    }
  }

  changeSpeed(player: HTMLAudioElement) {
    const rates = [1, 1.5, 2];
    const currentIndex = rates.indexOf(player.playbackRate);
    const nextIndex = (currentIndex + 1) % rates.length;
    player.playbackRate = rates[nextIndex];
  }

  seek(player: HTMLAudioElement, event: MouseEvent) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = event.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    if (player.duration) {
      player.currentTime = percentage * player.duration;
    }
  }

  actualizarMensajeLista(updatedMsg: ChatMensaje) {
    this.mensajes.update((msgs) => msgs.map((m) => (m.id === updatedMsg.id ? updatedMsg : m)));
  }

  enviarOferta() {
    const precio = this.precioOferta();
    if (!precio || precio <= 0 || (this.conversacion.producto && precio < this.minPrecioPermitido())) return;
    
    this.onEnviarMensaje({ 
      tipo: 'OFERTA_PRECIO', 
      precioPropuesto: precio 
    } as ChatDraft);
    this.mostrarOfertaModal.set(false);
    this.precioOferta.set(null);
  }

  onEnviarMensaje(draft: ChatDraft) {
    const currUser = this.authStore.user();
    if (!currUser || !this.conversacion) return;

    const productoId = this.conversacion.producto?.id || null;
    const otroId = this.otroUsuario()?.id;
    const roomId =
      this.conversacion.roomId ||
      (productoId
        ? `P_${productoId}`
        : `D_${Math.min(currUser.id, otroId)}_${Math.max(currUser.id, otroId)}`);

    if (!otroId) {
      this.toast.error('No se ha podido identificar al destinatario');
      return;
    }

    if (draft.tipo === 'TEXTO' && draft.texto) {
      // Optimistic UI: añadir mensaje inmediatamente
      const optimisticMsg: any = {
        id: -Date.now(), // ID negativo para identificar como optimista
        remitente: currUser,
        receptor: this.otroUsuario(),
        producto: this.conversacion.producto,
        tipo: 'TEXTO',
        texto: draft.texto,
        fechaEnvio: new Date().toISOString(),
        leido: false,
        roomId: roomId,
      };
      this.mensajes.update((m) => [...m, optimisticMsg]);
      this.autoScrollActivado = true;

      // Enviar por WebSocket STOMP (si conectado) o por REST como fallback
      if (this.wsService.isConnected) {
        this.wsService.enviarMensajeChat(productoId, currUser.id, otroId, draft.texto, roomId);
      } else {
        // Fallback: enviar por REST
        this.chatService
          .enviarTexto(productoId, currUser.id, otroId, draft.texto, roomId)
          .subscribe({
            next: (savedMsg) => {
              this.mensajes.update((msgs) =>
                msgs.map((m) => (m.id === optimisticMsg.id ? savedMsg : m)),
              );
            },
            error: () => {
              // Revertir optimistic
              this.mensajes.update((msgs) => msgs.filter((m) => m.id !== optimisticMsg.id));
              this.toast.error('Error al enviar el mensaje.');
            },
          });
      }
    } else if ((draft.tipo === 'IMAGEN' || draft.tipo === 'AUDIO') && draft.archivo) {
      // Optimistic placeholder
      const placeholderMsg: any = {
        id: -Date.now(),
        remitente: currUser,
        receptor: this.otroUsuario(),
        producto: this.conversacion.producto,
        tipo: draft.tipo,
        texto: draft.tipo === 'IMAGEN' ? '📷 Enviando imagen...' : '🎤 Enviando audio...',
        fechaEnvio: new Date().toISOString(),
        leido: false,
        roomId: roomId,
      };
      this.mensajes.update((m) => [...m, placeholderMsg]);
      this.autoScrollActivado = true;

      // REST para subir archivos
      this.chatService
        .subirMedia(
          productoId,
          currUser.id,
          otroId,
          draft.tipo,
          draft.archivo,
          draft.duracionSegundos || 0,
          roomId,
        )
        .subscribe({
          next: (savedMsg) => {
            this.mensajes.update((msgs) =>
              msgs.map((m) => (m.id === placeholderMsg.id ? savedMsg : m)),
            );
            this.autoScrollActivado = true;
          },
          error: () => {
            this.mensajes.update((msgs) => msgs.filter((m) => m.id !== placeholderMsg.id));
            this.toast.error('Error al subir el archivo multimedia.');
          },
        });
    } else if (draft.tipo === 'GIF' || draft.tipo === 'OFERTA_PRECIO') {
      const optimisticMsg: any = {
        id: -Date.now(), // ID negativo para identificar como optimista
        remitente: currUser,
        receptor: this.otroUsuario(),
        producto: this.conversacion.producto,
        tipo: draft.tipo,
        texto: draft.texto,
        mediaUrl: draft.tipo === 'GIF' ? draft.texto : null,
        precioPropuesto: draft.tipo === 'OFERTA_PRECIO' ? draft.precioPropuesto : null,
        estadoPropuesta: draft.tipo === 'OFERTA_PRECIO' ? 'PENDIENTE' : null,
        fechaEnvio: new Date().toISOString(),
        leido: false,
        roomId: roomId,
      };
      this.mensajes.update((m) => [...m, optimisticMsg]);
      this.autoScrollActivado = true;

      if (this.wsService.isConnected) {
        if (draft.tipo === 'GIF' && draft.texto) {
          this.wsService.enviarGif(productoId, currUser.id, otroId, draft.texto, roomId);
        } else if (draft.tipo === 'OFERTA_PRECIO' && draft.precioPropuesto) {
          this.wsService.enviarPropuestaPrecio(
            productoId,
            currUser.id,
            otroId,
            draft.precioPropuesto,
            roomId,
          );
        }
      }
    }
  }

  notificarEscribiendo() {
    const currUser = this.authStore.user();
    if (currUser && this.conversacion && this.otroUsuario()) {
      const productoId = this.conversacion.producto?.id || null;
      const otroId = this.otroUsuario().id;
      const roomId =
        this.conversacion.roomId ||
        (productoId
          ? `P_${productoId}`
          : `D_${Math.min(currUser.id, otroId)}_${Math.max(currUser.id, otroId)}`);
      this.wsService.notificarEscribiendo(productoId, currUser.id, roomId);
    }
  }

  startPress(event: Event, mensaje: ChatMensaje) {
    this.isLongPress = false;
    this.pressTimer = setTimeout(() => {
      this.isLongPress = true;
      this.toggleMensajeMenu(event, mensaje);
      if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(50); // Feedback háptico
      }
    }, 600);
  }

  endPress(event: Event, msg?: any) {
    if (this.pressTimer) {
      clearTimeout(this.pressTimer);
    }
    // Si fue un click corto y es una imagen, podemos manejar la apertura
    if (!this.isLongPress && msg?.tipo === 'IMAGEN') {
      // Opcional: manejar click normal en imagen
    }
  }

  toggleMensajeMenu(event: Event, mensaje: ChatMensaje) {
    if (event) event.stopPropagation();
    if (this.mensajeSeleccionado()?.id === mensaje.id) {
      this.mensajeSeleccionado.set(null);
    } else {
      this.mensajeSeleccionado.set(mensaje);
    }
  }

  cerrarMenuMensaje() {
    this.mensajeSeleccionado.set(null);
  }

  eliminarMensajeParaMi(mensajeId: number) {
    const currUser = this.authStore.user();
    if (!currUser) return;

    this.chatService.eliminarMensajeParaMi(mensajeId, currUser.id).subscribe({
      next: () => {
        this.mensajes.update(msgs => msgs.filter(m => m.id !== mensajeId));
        this.toast.success('Mensaje eliminado para ti');
        this.mensajeSeleccionado.set(null);
      },
      error: (err) => {
        this.toast.error('Error al eliminar mensaje: ' + (err.error?.error || err.message));
      }
    });
  }

  ngOnDestroy() {
    this.wsSub?.unsubscribe();
    this.leidosSub?.unsubscribe();
    this.recibidosSub?.unsubscribe();
    this.ui.activeChatRoomId.set(null);
  }

  validarFormatoPrecio(event: any) {
    const input = event.target as HTMLInputElement;
    let value = input.value;
    
    if (value.includes('.')) {
      const [entero, decimal] = value.split('.');
      if (decimal.length > 2) {
        value = entero + '.' + decimal.slice(0, 2);
        input.value = value;
      }
    }
    
    this.precioOferta.set(value === '' ? null : parseFloat(value));
  }

  navigateToProduct(item: any) {
    if (!item) return;
    const slug = createFriendlySlug(item.titulo, item.id);
    this.router.navigate(['/productos', slug]);
  }
}
