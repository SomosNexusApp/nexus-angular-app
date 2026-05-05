import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { environment } from '../../../environments/environment';
import { JwtService } from '../auth/jwt-service';
import { AuthStore } from '../auth/auth-store';

export interface ChatMensaje {
  id: number;
  remitente: { id: number; nombre: string; avatar?: string };
  receptor: { id: number; nombre: string; avatar?: string };
  producto: { id: number; titulo: string; imagenPrincipal?: string; coverImage?: string };
  texto?: string;
  mediaUrl?: string;
  mediaThumbnail?: string;
  audioDuracionSegundos?: number;
  tipo: string;
  fechaEnvio: string;
  leido: boolean;
  recibido?: boolean;
  precioPropuesto?: number;
  estadoPropuesta?: string;
  roomId?: string;
  eliminadoParaRemitente?: boolean;
  eliminadoParaReceptor?: boolean;
}

export interface Notificacion {
  id: number;
  titulo: string;
  mensaje: string;
  fecha: string;
  leida: boolean;
  tipo: string;
  url?: string;
}

// servicio que maneja la conexion WebSocket con el backend usando STOMP sobre SockJS
// SockJS hace fallback a polling si el navegador no soporta WebSockets nativos
// STOMP es un protocolo de mensajeria que funciona por encima del WebSocket
@Injectable({ providedIn: 'root' })
export class WebSocketService {
  private client: Client | null = null;
  private jwt = inject(JwtService);
  private auth = inject(AuthStore);
  private http = inject(HttpClient);

  // subjects que emiten cuando llegan mensajes/notificaciones/eventos del servidor
  // son privados para que solo este servicio pueda emitir en ellos
  private mensajes$ = new Subject<ChatMensaje>();
  private notificaciones$ = new Subject<Notificacion>();
  private leidos$ = new Subject<{ roomId: string; usuarioId: number }>();
  private recibidos$ = new Subject<{ roomId: string; usuarioId: number }>();
  // signal de Angular para el contador de conversaciones no leidas (actualiza la UI automaticamente)
  unreadConvCount = signal(0);
  // flag temporal para animar el icono de chat en el header
  newMsgTrigger = signal(false);

  // exponemos los subjects como observables de solo lectura para que los componentes puedan suscribirse
  readonly mensajes = this.mensajes$.asObservable();
  readonly notificaciones = this.notificaciones$.asObservable();
  readonly leidos = this.leidos$.asObservable();
  readonly recibidos = this.recibidos$.asObservable();

  // guardamos los topics a los que ya estamos suscritos para no suscribirnos dos veces
  // si nos suscribimos dos veces recibiríamos cada mensaje duplicado
  private subscribedTopics = new Set<string>();
  // topics que queremos suscribir pero estamos esperando a que conecte el socket
  private pendingSubscriptions = new Set<string>();

  connect(): void {
    const token = this.jwt.getToken();
    // si no hay token o ya estamos conectados, no hacemos nada
    if (!token || this.client?.connected) return;

    this.client = new Client({
      // usamos SockJS como transporte (soporta fallback a polling HTTP)
      webSocketFactory: () => new SockJS(`${environment.wsUrl}/ws`, null, {
        transports: ['websocket', 'xhr-streaming', 'xhr-polling']
      }),
      // mandamos el JWT en la cabecera de conexion para que el backend nos identifique
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 5000, // reintenta la conexion cada 5 segundos si se cae
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: () => {
        const userId = this.auth.user()?.id;
        if (!userId) return;

        // cola privada de notificaciones: solo las recibe este usuario
        // el /user/ prefix hace que STOMP enrute el mensaje solo a esta sesion
        this.client!.subscribe(`/user/queue/notificaciones`, (msg) => {
          console.log('🔔 Notificación recibida por WS:', msg.body);
          this.notificaciones$.next(JSON.parse(msg.body));
          // actualizamos el contador cada vez que llega una notificacion
          this.refreshUnreadCount();
          this.triggerBadgeAnimation();
        });

        // hacemos la primera consulta al conectar para tener el conteo actualizado
        this.refreshUnreadCount();
        console.log('✅ WebSocket conectado y suscrito a notificaciones');

        // procesamos suscripciones pendientes
        this.pendingSubscriptions.forEach(topic => this.ejecutarSuscripcion(topic));
        this.pendingSubscriptions.clear();
      },
      onStompError: (frame) => {
        console.error('❌ STOMP error:', frame.headers['message'], frame.body);
      },
      onWebSocketError: (event) => {
        console.error('❌ WebSocket error:', event);
      }
    });

    this.client.activate();
  }

  suscribirseAlChat(roomId: string): void {
    const topicKey = `/topic/chat/${roomId}`;
    this.gestionarSuscripcion(topicKey, (msg) => {
      this.mensajes$.next(JSON.parse(msg.body));
    });
  }

  /**
   * Helper para manejar suscripciones diferidas si el socket aún no está listo.
   */
  private gestionarSuscripcion(topic: string, callback: (msg: any) => void): void {
    if (this.subscribedTopics.has(topic)) return;

    if (this.client?.connected) {
      this.ejecutarSuscripcion(topic, callback);
    } else {
      this.pendingSubscriptions.add(topic);
      // guardamos el callback para cuando conecte (en un mapa si fuera necesario, 
      // pero aquí los callbacks son fijos por tipo de topic)
    }
  }

  private ejecutarSuscripcion(topic: string, callback?: (msg: any) => void): void {
    if (!this.client?.connected || this.subscribedTopics.has(topic)) return;

    console.log('📡 Suscribiendo a topic:', topic);
    this.subscribedTopics.add(topic);
    
    // Determinamos el callback según el topic si no se provee
    const cb = callback || this.getCallbackForTopic(topic);
    
    if (cb) {
      this.client.subscribe(topic, (msg) => {
        console.log(`📩 Mensaje recibido en ${topic}`);
        cb(msg);
      });
    }
  }

  private getCallbackForTopic(topic: string): ((msg: any) => void) | null {
    if (topic.startsWith('/topic/chat/') && topic.endsWith('/leidos')) {
      return (msg) => this.leidos$.next(JSON.parse(msg.body));
    }
    if (topic.startsWith('/topic/chat/') && topic.endsWith('/recibidos')) {
      return (msg) => this.recibidos$.next(JSON.parse(msg.body));
    }
    if (topic.startsWith('/topic/chat/')) {
      return (msg) => this.mensajes$.next(JSON.parse(msg.body));
    }
    return null;
  }

  // actualiza el numero de conversaciones no leidas consultando la api
  refreshUnreadCount(): void {
    const user = this.auth.user();
    if (!user) return;
    this.http
      .get<{ noLeidos: number }>(`${environment.apiUrl}/chat/no-leidos/${user.id}/conversaciones`)
      .subscribe((res) => this.unreadConvCount.set(res.noLeidos));
  }

  private triggerBadgeAnimation() {
    this.newMsgTrigger.set(true);
    setTimeout(() => this.newMsgTrigger.set(false), 1000);
  }

  // desconecta del websocket y limpia los topics suscritos
  disconnect(): void {
    this.client?.deactivate();
    this.client = null;
    this.subscribedTopics.clear();
  }

  /**
   * Enviar mensaje de texto via STOMP.
   * Destination: /app/chat.enviar (según ChatWebSocketController.java)
   */
  enviarMensajeChat(
    productoId: number | null,
    remitenteId: number,
    receptorId: number,
    texto: string,
    roomId: string,
  ): void {
    if (this.client?.connected) {
      this.client.publish({
        destination: '/app/chat.enviar',
        body: JSON.stringify({
          productoId,
          remitenteId,
          receptorId,
          texto,
          tipo: 'TEXTO',
          roomId,
        }),
      });
    }
  }

  /**
   * Enviar propuesta de precio via STOMP.
   */
  enviarPropuestaPrecio(
    productoId: number | null,
    remitenteId: number,
    receptorId: number,
    precio: number,
    roomId: string,
  ): void {
    if (this.client?.connected) {
      this.client.publish({
        destination: '/app/chat.enviar',
        body: JSON.stringify({
          productoId,
          remitenteId,
          receptorId,
          tipo: 'OFERTA_PRECIO',
          precioPropuesto: precio,
          roomId,
        }),
      });
    }
  }

  /**
   * Enviar GIF via STOMP.
   */
  enviarGif(
    productoId: number | null,
    remitenteId: number,
    receptorId: number,
    mediaUrl: string,
    roomId: string,
  ): void {
    if (this.client?.connected) {
      this.client.publish({
        destination: '/app/chat.enviar',
        body: JSON.stringify({
          productoId,
          remitenteId,
          receptorId,
          tipo: 'GIF',
          mediaUrl,
          roomId,
        }),
      });
    }
  }

  suscribirseALeidos(roomId: string): void {
    const topicKey = `/topic/chat/${roomId}/leidos`;
    this.gestionarSuscripcion(topicKey, (msg) => {
      this.leidos$.next(JSON.parse(msg.body));
    });
  }

  /**
   * Suscribirse al topic de recibido para saber cuándo el otro usuario recibe mis mensajes.
   */
  suscribirseARecibidos(roomId: string): void {
    const topicKey = `/topic/chat/${roomId}/recibidos`;
    this.gestionarSuscripcion(topicKey, (msg) => {
      this.recibidos$.next(JSON.parse(msg.body));
    });
  }

  /**
   * Notificar al backend que he recibido los mensajes de una sala (los tengo cargados o me han llegado por WS).
   */
  marcarComoRecibido(roomId: string, usuarioId: number): void {
    if (this.client?.connected) {
      this.client.publish({
        destination: '/app/chat.recibido',
        body: JSON.stringify({ roomId, usuarioId }),
      });
    }
  }

  /**
   * Notificar al backend que he leído los mensajes de una sala.
   * Destination: /app/chat.leer (según ChatWebSocketController.java)
   */
  marcarComoLeido(roomId: string, usuarioId: number): void {
    if (this.client?.connected) {
      this.client.publish({
        destination: '/app/chat.leer',
        body: JSON.stringify({ roomId, usuarioId }),
      });
    }
  }

  // notifica al otro usuario que estamos escribiendo en tiempo real
  // se usa para el indicador "escribiendo..." del chat
  notificarEscribiendo(productoId: number | null, remitenteId: number, roomId: string): void {
    if (this.client?.connected) {
      this.client.publish({
        destination: '/app/chat.escribiendo',
        body: JSON.stringify({
          productoId,
          roomId,
          remitenteId,
          escribiendo: true,
        }),
      });
    }
  }

  // getter para saber desde fuera si estamos conectados
  get isConnected(): boolean {
    return this.client?.connected ?? false;
  }
}
