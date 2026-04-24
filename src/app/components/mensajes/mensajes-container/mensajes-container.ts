import { Component, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ConversacionesListComponent } from '../conversaciones-list/conversaciones-list';
import { ChatPanelComponent } from '../chat-panel/chat-panel';
import { AuthStore } from '../../../core/auth/auth-store';
import { environment } from '../../../../environments/environment';

import { UiService } from '../../../core/services/ui.service';

@Component({
  selector: 'app-mensajes-container',
  standalone: true,
  imports: [CommonModule, ConversacionesListComponent, ChatPanelComponent],
  templateUrl: './mensajes-container.html',
  styleUrl: './mensajes-container.css',
})
export class MensajesContainerComponent implements OnInit, OnDestroy {
  conversacionSeleccionada = signal<any>(null);

  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private authStore = inject(AuthStore);
  private uiService = inject(UiService);

  ngOnInit() {
    this.route.queryParams.subscribe((params) => {
      const productoId = params['productoId'];
      const usuarioId = params['usuarioId'];
      if (productoId) {
        this.iniciarNuevaConversacion(Number(productoId));
      } else if (usuarioId) {
        this.iniciarConversacionDirecta(Number(usuarioId));
      }
    });
  }

  onConversacionCambiada(conv: any) {
    this.conversacionSeleccionada.set(conv);
    this.uiService.isAnyChatSelected.set(!!conv);
  }

  private iniciarNuevaConversacion(productoId: number) {
    // Buscar si ya tenemos la conversación en la lista del hijo no es sencillo desde aquí sin ViewChild,
    // pero podemos forzar la carga del producto y crear un "mock" de conversación inicial
    // para que el chat-panel lo renderice. Cuando envíe el 1º mensaje, se guardará de verdad.

    this.http.get<any>(`${environment.apiUrl}/producto/${productoId}`).subscribe({
      next: (producto) => {
        const currentUser = this.authStore.user();
        if (!currentUser) return;

        // Vendedor del producto
        const vendedor = producto.vendedor;
        if (!vendedor || vendedor.id === currentUser.id) return; // No chatear consigo mismo

        // Construir fake ChatMensaje inicial solo estructurado para que el panel lo trague
        const fakeConv = {
          id: -1, // ID negativo indica que es nueva / en memoria
          producto: producto,
          roomId: `P_${producto.id}`,
          remitente: currentUser,
          receptor: vendedor,
          texto: '',
          tipo: 'SISTEMA',
          fechaEnvio: new Date().toISOString(),
          leido: true,
        };

        this.conversacionSeleccionada.set(fakeConv);
        this.uiService.isAnyChatSelected.set(true);
      },
    });
  }

  private iniciarConversacionDirecta(usuarioId: number) {
    this.http.get<any>(`${environment.apiUrl}/api/usuario/${usuarioId}`).subscribe({
      next: (otroUsuario) => {
        const currentUser = this.authStore.user();
        if (!currentUser || currentUser.id === otroUsuario.id) return;

        const fakeConv = {
          id: -1,
          producto: null,
          roomId: `D_${Math.min(currentUser.id, otroUsuario.id)}_${Math.max(currentUser.id, otroUsuario.id)}`,
          remitente: currentUser,
          receptor: otroUsuario,
          texto: '',
          tipo: 'SISTEMA',
          fechaEnvio: new Date().toISOString(),
          leido: true,
        };

        this.conversacionSeleccionada.set(fakeConv);
        this.uiService.isAnyChatSelected.set(true);
      },
    });
  }
  ngOnDestroy() {
    this.uiService.isAnyChatSelected.set(false);
  }
}
