import { Component, Input, Output, EventEmitter, inject, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { AuthStore } from '../../../core/auth/auth-store';
import { ToastService } from '../../../core/services/toast.service';
import { StarRatingComponent } from '../star-rating/star-rating.component';

@Component({
  selector: 'app-valoracion-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, StarRatingComponent],
  template: `
    @if (isOpen()) {
      <div class="modal-overlay" (click)="cerrar()">
        <div class="modal-content animate-slide-up" [class.modal-content-lg]="modoGrande" (click)="$event.stopPropagation()">
          <button class="close-btn" (click)="cerrar()">×</button>
          
          <div class="modal-header">
            <h2>Valora tu experiencia con @{{ vendedorUsername() }}</h2>
          </div>

          <div class="modal-body">
            @if (!completado()) {
              <div class="rating-section">
                <p>¿Qué te pareció la transacción?</p>
                <div class="stars-wrapper">
                  <app-star-rating 
                    [rating]="estrellas()" 
                    [interactive]="true" 
                    (ratingChange)="estrellas.set($event)">
                  </app-star-rating>
                </div>
              </div>

              <div class="comment-section">
                <label>Comentario (opcional)</label>
                <textarea 
                  [(ngModel)]="comentario" 
                  rows="3" 
                  maxlength="500"
                  placeholder="Escribe tu opinión sobre el vendedor y el producto (máx 500 chars)..."
                  class="desc-input">
                </textarea>
                <div class="char-count">{{ comentario().length }} / 500</div>
              </div>
              
              @if (error()) { <div class="error-msg">{{ error() }}</div> }
              
              <div class="actions">
                <button class="btn-secondary" (click)="cerrar()">Cancelar</button>
                <button class="btn-primary" 
                  [disabled]="estrellas() === 0 || enviando()" 
                  (click)="enviarValoracion()">
                  {{ enviando() ? 'Enviando...' : 'Publicar Valoración' }}
                </button>
              </div>
            } @else {
              <div class="success-view">
                <svg viewBox="0 0 24 24" class="success-icon"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor"/></svg>
                <h3>¡Valoración enviada!</h3>
                <p>Gracias por contribuir a la comunidad de Nexus.</p>
                <button class="btn-primary mt-4" (click)="cerrar()">Cerrar</button>
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
      width: 100%; max-width: 450px; 
      max-height: 90vh;
      overflow-y: auto;
      padding: 32px;
      position: relative; 
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
      color: var(--text-primary, #ffffff);
      text-align: center;
      scrollbar-width: thin;
      scrollbar-color: rgba(255,255,255,0.1) transparent;
    }
    .modal-content::-webkit-scrollbar { width: 4px; }
    .modal-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }

    @media (max-width: 600px) {
      .modal-overlay {
        padding: 0;
        align-items: flex-end;
      }
      .modal-content {
        max-width: 100%;
        max-height: 85vh;
        border-radius: 30px 30px 0 0;
        padding: 40px 24px 32px;
        padding-bottom: calc(32px + env(safe-area-inset-bottom, 20px));
        border-bottom: none;
      }
      .close-btn { top: 16px; right: 16px; }
      .stars-wrapper { transform: scale(1.2); }
    }
    .modal-content.modal-content-lg { max-width: 680px; padding: 40px; }
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
      margin: 0 0 24px 0; 
      font-size: 1.5rem; 
      font-family: var(--font-display);
      background: var(--gradient-primary);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    
    .rating-section p { margin-bottom: 12px; color: var(--text-secondary); }
    
    .stars-wrapper { margin-bottom: 24px; transform: scale(1.5); padding: 10px; display: flex; justify-content: center; }
    
    .comment-section { text-align: left; margin-bottom: 20px; }
    .comment-section label { display: block; font-size: 0.875rem; font-weight: 500; margin-bottom: 8px; color: var(--text-muted); }
    
    .desc-input {
      width: 100%; padding: 14px; 
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px; resize: none; 
      color: white; font-family: inherit;
      transition: 0.3s;
    }
    .desc-input:focus { outline: none; border-color: var(--nexus-purple); box-shadow: 0 0 0 2px rgba(205, 176, 232, 0.2); }
    
    .char-count { font-size: 0.75rem; color: var(--text-muted); text-align: right; margin-top: 4px;}
    
    .error-msg { color: var(--nexus-hot-pink); font-size: 0.875rem; margin-bottom: 16px; text-align: left;}
    
    .actions { display: flex; justify-content: flex-end; gap: 12px; }
    
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
    
    .success-view { padding: 20px 0; }
    .success-icon { width: 80px; height: 80px; color: var(--nexus-purple); margin: 0 auto 16px; }
    
    .animate-slide-up { animation: slideUp 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
    @keyframes slideUp {
      from { transform: translateY(30px) scale(0.95); opacity: 0; }
      to { transform: translateY(0) scale(1); opacity: 1; }
    }
    .mt-4 { margin-top: 16px; }
  `]
})
export class ValoracionModalComponent {
  @Input() modoGrande = true;
  private http = inject(HttpClient);
  private authStore = inject(AuthStore);
  private toast = inject(ToastService);

  isOpen = signal(false);
  vendedorUsername = signal<string>('');
  compraId = signal<number>(0);
  
  estrellas = signal<number>(0);
  comentario = signal<string>('');
  
  enviando = signal(false);
  error = signal<string>('');
  completado = signal(false);

  @Output() valoracionRegistrada = new EventEmitter<void>();

  abrir(vendedorUsername: string, compraId: number) {
    if (!this.authStore.isLoggedIn()) {
      this.toast.warning('Debes iniciar sesión para valorar.');
      return;
    }
    this.vendedorUsername.set(vendedorUsername);
    this.compraId.set(compraId);
    this.estrellas.set(0);
    this.comentario.set('');
    this.error.set('');
    this.completado.set(false);
    this.isOpen.set(true);
  }

  cerrar() {
    this.isOpen.set(false);
    if (this.completado()) {
      this.valoracionRegistrada.emit();
    }
  }

  enviarValoracion() {
    if (this.estrellas() === 0) {
      this.error.set('Por favor, selecciona una puntuación.');
      return;
    }

    this.enviando.set(true);
    this.error.set('');

    const body = {
      compraId: this.compraId(),
      compradorId: this.authStore.user()?.id,
      estrellas: this.estrellas(),
      comentario: this.comentario()
    };

    // La ruta según el backend es POST /valoracion
    this.http.post(`${environment.apiUrl}/valoracion`, body).subscribe({
      next: () => {
        this.enviando.set(false);
        this.completado.set(true); 
      },
      error: (err: any) => {
        this.enviando.set(false);
        this.error.set(err.error?.error || 'Error al guardar la valoración.');
      }
    });
  }
}
