import { Component, Input, Output, EventEmitter, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { AuthStore } from '../../../core/auth/auth-store';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-reporte-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (isOpen()) {
      <div class="modal-overlay" (click)="cerrar()">
        <div class="modal-content animate-slide-up" (click)="$event.stopPropagation()">
          <button class="close-btn" (click)="cerrar()">×</button>
          
          <div class="modal-header">
            <h2>Reportar {{ tipo() | titlecase }}</h2>
            <div class="step-indicator">Paso {{ step() }} de 3</div>
          </div>

          <div class="modal-body">
            @if (step() === 1) {
              <div class="step-content">
                <p>Estás a punto de reportar este contenido. Nuestro equipo de moderación revisará la solicitud.</p>
                <div class="info-box">
                  <strong>ID Referencia:</strong> {{ objetoId() }}
                </div>
                <button class="btn-primary" (click)="step.set(2)">Siguiente</button>
              </div>
            }

            @if (step() === 2) {
              <div class="step-content">
                <h3>¿Cuál es el motivo del reporte?</h3>
                <div class="motivos-list">
                  @for (motivo of motivos; track motivo.value) {
                    <label class="radio-label">
                      <input type="radio" name="motivo" [(ngModel)]="motivoSeleccionado" [value]="motivo.value">
                      <span class="radio-text">{{ motivo.label }}</span>
                    </label>
                  }
                </div>
                <div class="actions">
                  <button class="btn-secondary" (click)="step.set(1)">Atrás</button>
                  <button class="btn-primary" [disabled]="!motivoSeleccionado()" (click)="step.set(3)">Siguiente</button>
                </div>
              </div>
            }

            @if (step() === 3) {
              <div class="step-content">
                <h3>Describe el problema</h3>
                <p class="hint">Por favor, proporciona detalles para ayudarnos a investigar (min. 20 caracteres).</p>
                <textarea 
                  [(ngModel)]="descripcion" 
                  rows="4" 
                  placeholder="Escribe aquí los detalles del problema..."
                  class="desc-input">
                </textarea>
                <div class="char-count" [class.error]="descripcion().length > 0 && descripcion().length < 20">
                  {{ descripcion().length }} / 20 mín.
                </div>
                
                @if (error()) { <div class="error-msg">{{ error() }}</div> }
                
                <div class="actions">
                  <button class="btn-secondary" (click)="step.set(2)">Atrás</button>
                  <button class="btn-primary" 
                    [disabled]="descripcion().length < 20 || enviando()" 
                    (click)="enviarReporte()">
                    {{ enviando() ? 'Enviando...' : 'Enviar Reporte' }}
                  </button>
                </div>
              </div>
            }

            @if (step() === 4) {
              <div class="step-content success-view">
                <svg viewBox="0 0 24 24" class="success-icon"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor"/></svg>
                <h3>¡Reporte enviado!</h3>
                <p>Tu reporte ha sido enviado. Lo revisaremos en 24-48h.</p>
                <button class="btn-primary" (click)="cerrar()">Cerrar</button>
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .modal-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.8); backdrop-filter: blur(12px);
      display: flex; align-items: center; justify-content: center;
      z-index: 10000; padding: 20px;
    }
    .modal-content {
      background: var(--bg-surface, #0a0a0a);
      border: 1px solid var(--bg-glass-border, rgba(255,255,255,0.1));
      border-radius: var(--radius-lg, 24px);
      width: 100%; max-width: 480px; 
      max-height: 90vh;
      overflow-y: auto;
      padding: 32px;
      position: relative; 
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
      color: var(--text-primary, #ffffff);
      scrollbar-width: thin;
      scrollbar-color: rgba(255,255,255,0.1) transparent;
    }
    .modal-content::-webkit-scrollbar { width: 4px; }
    .modal-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }

    @media (max-width: 600px) {
      .modal-overlay {
        padding: 0;
        align-items: flex-end; /* Mobile: Bottom sheet style or full cover */
      }
      .modal-content {
        max-width: 100%;
        max-height: 85vh;
        border-radius: 30px 30px 0 0;
        padding: 40px 24px 32px;
        padding-bottom: calc(32px + env(safe-area-inset-bottom, 20px));
        border-bottom: none;
      }
      .close-btn {
        top: 16px;
        right: 16px;
      }
    }
    .close-btn {
      position: absolute; top: 20px; right: 20px;
      background: rgba(255,255,255,0.05); border: none; 
      width: 32px; height: 32px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; color: var(--text-secondary, #e0e0e0);
      transition: 0.2s;
    }
    .close-btn:hover { background: rgba(255,255,255,0.1); color: var(--nexus-pink); }
    
    .modal-header h2 { 
      margin: 0 0 8px 0; 
      font-size: 1.5rem; 
      font-family: var(--font-display);
      background: var(--gradient-primary);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .step-indicator { font-size: 0.875rem; color: var(--text-muted); margin-bottom: 24px; }
    
    .step-content { display: flex; flex-direction: column; gap: 20px; }
    .info-box { 
      background: rgba(255, 255, 255, 0.03); 
      padding: 16px; border-radius: 12px; 
      border: 1px solid rgba(255,255,255,0.05);
      font-family: monospace; color: var(--nexus-blue);
    }
    
    .motivos-list { display: flex; flex-direction: column; gap: 10px; }
    .radio-label { 
      display: flex; align-items: center; gap: 12px; 
      cursor: pointer; padding: 12px; border-radius: 10px;
      background: rgba(255,255,255,0.02); border: 1px solid transparent;
      transition: 0.2s;
    }
    .radio-label:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); }
    .radio-label input:checked + .radio-text { color: var(--nexus-purple); }
    
    .desc-input {
      width: 100%; padding: 14px; 
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px; resize: none; 
      color: white; font-family: inherit;
      transition: 0.3s;
    }
    .desc-input:focus { outline: none; border-color: var(--nexus-purple); box-shadow: 0 0 0 2px rgba(205, 176, 232, 0.2); }
    
    .hint { font-size: 0.875rem; color: var(--text-muted); margin: 0; }
    .char-count { font-size: 0.75rem; color: var(--text-muted); text-align: right; }
    .char-count.error { color: var(--nexus-hot-pink); }
    .error-msg { color: var(--nexus-hot-pink); font-size: 0.875rem; margin-top: 8px; }
    
    .actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 12px; }
    
    .btn-primary {
      background: var(--gradient-primary); color: #000; 
      border: none; padding: 12px 24px;
      border-radius: var(--radius-full); font-weight: 600; 
      cursor: pointer; transition: 0.3s;
    }
    .btn-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 20px -5px rgba(168, 180, 255, 0.4); }
    .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
    
    .btn-secondary {
      background: rgba(255,255,255,0.05); color: var(--text-primary); 
      border: 1px solid rgba(255,255,255,0.1); padding: 12px 24px;
      border-radius: var(--radius-full); font-weight: 500; cursor: pointer; transition: 0.2s;
    }
    .btn-secondary:hover { background: rgba(255,255,255,0.1); }
    
    .success-view { text-align: center; padding: 20px 0; }
    .success-icon { width: 80px; height: 80px; color: var(--nexus-purple); margin: 0 auto 16px; }
    
    .animate-slide-up { animation: slideUp 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
    @keyframes slideUp {
      from { transform: translateY(30px) scale(0.95); opacity: 0; }
      to { transform: translateY(0) scale(1); opacity: 1; }
    }
  `]
})
export class ReporteModalComponent {
  private http = inject(HttpClient);
  private authStore = inject(AuthStore);
  private toast = inject(ToastService);

  // En la app real se usa guestPopupService si no está logueado, pero el llamador comprobará.
  
  isOpen = signal(false);
  tipo = signal<string>('PRODUCTO'); // PRODUCTO, OFERTA, USUARIO, MENSAJE
  objetoId = signal<number>(0);
  
  step = signal(1);
  motivoSeleccionado = signal<string>('');
  descripcion = signal<string>('');
  enviando = signal(false);
  error = signal<string>('');

  @Output() modalClosed = new EventEmitter<void>();

  motivos = [
    { value: 'SPAM', label: 'Spam comercial o publicidad' },
    { value: 'FRAUDE', label: 'Fraude o posible estafa' },
    { value: 'INFORMACION_FALSA', label: 'Información falsa o engañosa' },
    { value: 'ACOSO', label: 'Acoso o comportamiento abusivo' },
    { value: 'CONTENIDO_INAPROPIADO', label: 'Contenido inapropiado u ofensivo' },
    { value: 'PRODUCTO_FALSO', label: 'Producto falsificado' },
    { value: 'PRECIO_INCORRECTO', label: 'Precio incorrecto o engañoso' },
    { value: 'DUPLICADO', label: 'Anuncio duplicado' },
    { value: 'OTRO', label: 'Otro motivo' }
  ];

  abrir(tipo: string, id: number) {
    // Si no está logueado, el llamador debería manejarlo, pero podemos añadir un safe-check.
    if (!this.authStore.isLoggedIn()) {
      this.toast.warning('Debes iniciar sesión para reportar.');
      return;
    }
    
    this.tipo.set(tipo);
    this.objetoId.set(id);
    this.step.set(1);
    this.motivoSeleccionado.set('');
    this.descripcion.set('');
    this.error.set('');
    this.isOpen.set(true);
  }

  cerrar() {
    this.isOpen.set(false);
    this.modalClosed.emit();
  }

  enviarReporte() {
    if (this.descripcion().length < 20 || !this.motivoSeleccionado()) {
      this.error.set('Por favor, completa todos los campos requeridos.');
      return;
    }

    this.enviando.set(true);
    this.error.set('');

    const body = {
      reportadorId: this.authStore.user()?.id,
      tipo: this.tipo().toUpperCase(),
      motivo: this.motivoSeleccionado(),
      descripcion: this.descripcion(),
      objetoId: this.objetoId()
    };

    this.http.post(`${environment.apiUrl}/reporte`, body).subscribe({
      next: () => {
        this.enviando.set(false);
        this.step.set(4); // Pantalla de éxito
      },
      error: (err: any) => {
        this.enviando.set(false);
        this.error.set(err.error?.error || 'Ocurrió un error al enviar el reporte.');
      }
    });
  }
}
