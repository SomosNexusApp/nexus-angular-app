import { Component, OnInit, inject, signal, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { AuthStore } from '../../../core/auth/auth-store';
import { CurrencyEsPipe } from '../../../shared/pipes/currency-es.pipe';
import { TimeAgoPipe } from '../../../shared/pipes/time-ago.pipe';
import { FormsModule } from '@angular/forms';
import { ReporteModalComponent } from '../../../shared/components/reporte-modal/reporte-modal.component';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmacionModalComponent } from '../../../shared/components/confirmacion-modal/confirmacion-modal.component';
import { UiService } from '../../../core/services/ui.service';
import { Location } from '@angular/common';
import { FavoritoService } from '../../../core/services/favorito.service';
import { GuestPopupService } from '../../../core/services/guest-popup.service';
import { extractIdFromSlug } from '../../../shared/utils/slug-utils';

export interface PollOption { text: string; votes: number; }
export interface PollData { question: string; options: PollOption[]; totalVotes: number; votedUsers: number[]; }

import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';

@Component({
  selector: 'app-oferta-detail',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    CurrencyEsPipe, 
    TimeAgoPipe, 
    FormsModule, 
    ReporteModalComponent, 
    ConfirmacionModalComponent,
    AvatarComponent
  ],
  templateUrl: './oferta-detail.component.html',
  styleUrls: ['./oferta-detail.component.css']
})
export class OfertaDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  authStore = inject(AuthStore);
  private toast = inject(ToastService);
  private uiService = inject(UiService);
  private location = inject(Location);
  private favoritoService = inject(FavoritoService);
  private guestPopup = inject(GuestPopupService);

  public isMobileUI = this.uiService.isMobileUI;

  @ViewChild(ReporteModalComponent) reporteModal!: ReporteModalComponent;
  @ViewChild(ConfirmacionModalComponent) confirmModal!: ConfirmacionModalComponent;
  @ViewChild('composer') composer!: ElementRef;

  oferta = signal<any>(null);
  comentarios = signal<any[]>([]);
  nuevoComentario = '';
  cargando = signal(true);
  enviandoComentario = signal(false);
  favicon = signal<string>('');
  countdown = signal<string>('');
  copiado = signal(false);
  votando = signal(false);
  selectedImage = signal<string | null>(null);
  selectedImageIdx = signal<number>(0);
  galeria = signal<string[]>([]);
  esFavorito = signal(false);
  
  // High-End Tilt Control
  tiltX = signal(0);
  tiltY = signal(0);
  isHoveringImg = signal(false);
  
  // Gestión de Comentarios y Formato
  editandoId = signal<number | null>(null);
  textoEditando = '';
  mostrandoCreadorEncuesta = signal(false);
  preguntaEncuesta = '';
  opcionesEncuesta: string[] = ['', ''];

  // Lightbox Exhibition
  isLightboxOpen = signal(false);
  activeLightboxImg = signal<string | null>(null);

  // Real Actor Stats
  actorReputation = signal<number>(0);
  actorSales = signal<number>(0);
  logoError = signal(false);

  private timer?: any;

  ngOnInit() {
    window.scrollTo(0, 0);
    this.uiService.isDetailView.set(true);
    this.route.params.subscribe(params => {
      const slug = params['slug'];
      if (slug) {
        const id = extractIdFromSlug(slug);
        if (id) this.cargarOferta(id);
      }
    });
  }

  ngOnDestroy() {
    this.uiService.isDetailView.set(false);
    if (this.timer) clearInterval(this.timer);
  }

  back() {
    this.location.back();
  }

  private cargarOferta(id: string) {
    const usuarioId = this.authStore.user()?.id;
    const url = `${environment.apiUrl}/oferta/${id}${usuarioId ? '?usuarioId='+usuarioId : ''}`;

    this.http.get<any>(url).subscribe({
      next: (res) => {
        this.oferta.set(res);
        this.selectedImage.set(res.imagenPrincipal);
        
        // Construir la galería combinando imagenPrincipal y galeriaImagenes sin duplicados
        const imgs = new Set<string>();
        if (res.imagenPrincipal) imgs.add(res.imagenPrincipal);
        if (res.galeriaImagenes) res.galeriaImagenes.forEach((img: string) => imgs.add(img));
        
        const finalGallery = Array.from(imgs);
        this.galeria.set(finalGallery);
        this.selectedImageIdx.set(0);

        this.cargando.set(false);
        this.extraerFavicon(res.urlOferta);
        this.cargarComentarios(id);
        if (res.fechaExpiracion) this.startTimer();
        this.verificarFavorito(res.id);

        // Real Reputation Mapping
        const actor = res.actor;
        if (actor) {
          // Si es un número como 95, lo mapeamos a 4.75; si es 0-5 lo dejamos.
          const rep = actor.reputacion || 0;
          this.actorReputation.set(rep > 5 ? rep / 20 : rep);
          this.actorSales.set(actor.totalVentas || 0);
        }
      },
      error: () => this.cargando.set(false)
    });
  }

  private cargarComentarios(id: string) {
    this.http.get<any[]>(`${environment.apiUrl}/comentario/oferta/${id}`).subscribe(res => {
      const parsed = res.map(c => ({
        ...c,
        poll: c.pollJson ? JSON.parse(c.pollJson) : null
      }));
      this.comentarios.set(parsed);
    });
  }

  private extraerFavicon(url: string) {
    try {
      const domain = new URL(url).hostname;
      this.favicon.set(`https://www.google.com/s2/favicons?domain=${domain}&sz=64`);
    } catch (e) {
      this.favicon.set('assets/icons/store-fallback.svg');
    }
  }

  private startTimer() {
    const update = () => {
      if (!this.oferta()?.fechaExpiracion) return;
      const diff = new Date(this.oferta().fechaExpiracion).getTime() - Date.now();
      if (diff <= 0) { this.countdown.set('EXPIRADA'); clearInterval(this.timer); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      this.countdown.set(`${h}h ${m}m ${s}s`);
    };
    update();
    this.timer = setInterval(update, 1000);
  }

  votar(esSpark: boolean) {
    if (!this.authStore.isLoggedIn()) { 
      this.toast.info('Inicia sesión para votar este chollo');
      this.guestPopup.showPopup('Para votar chollos');
      return; 
    }
    if (this.votando()) return;

    const voteType = esSpark ? 'SPARK' : 'DRIP';

    // Si hace click en el voto que ya tiene, se retira el voto (Toggle off)
    if (this.oferta().miVoto === voteType) {
      this.procesarVoto(esSpark);
      return;
    }

    this.procesarVoto(esSpark);
  }

  private procesarVoto(esSpark: boolean) {
    this.votando.set(true);
    const previousState = { ...this.oferta() };
    const voteType = esSpark ? 'SPARK' : 'DRIP';
    
    this.oferta.update(o => {
      let newScore = o.sparkScore || 0;
      let newVoto = o.miVoto;
      
      if (o.miVoto === 'SPARK') newScore -= 1;
      else if (o.miVoto === 'DRIP') newScore += 1;

      if (o.miVoto === voteType) {
        newVoto = 'NONE';
      } else {
        newVoto = voteType;
        if (newVoto === 'SPARK') newScore += 1;
        else if (newVoto === 'DRIP') newScore -= 1;
      }
      return { ...o, sparkScore: newScore, miVoto: newVoto };
    });

    const params = new HttpParams()
      .set('usuarioId', this.authStore.user()!.id.toString())
      .set('esSpark', esSpark.toString());

    this.http.post(`${environment.apiUrl}/oferta/${previousState.id}/votar`, {}, { params }).subscribe({
      next: (res: any) => {
        this.oferta.update(o => ({ 
          ...o, 
          sparkScore: res.sparkScore, 
          badge: res.badge,
          miVoto: res.miVoto 
        }));
      },
      error: (err) => {
        console.error('Error voting:', err);
        this.oferta.set(previousState);
        this.confirmModal.abrir('Error', 'No se pudo procesar tu voto. Intenta de nuevo más tarde.', 'WARNING');
      },
      complete: () => {
        this.votando.set(false);
      }
    });
  }

  selectImage(img: string, idx: number) {
    this.selectedImage.set(img);
    this.selectedImageIdx.set(idx);
  }

  nextImage() {
    const nextIdx = (this.selectedImageIdx() + 1) % this.galeria().length;
    this.selectImage(this.galeria()[nextIdx], nextIdx);
  }

  prevImage() {
    const prevIdx = (this.selectedImageIdx() - 1 + this.galeria().length) % this.galeria().length;
    this.selectImage(this.galeria()[prevIdx], prevIdx);
  }

  openLightbox(img?: string) {
    this.activeLightboxImg.set(img || this.selectedImage());
    this.isLightboxOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  closeLightbox() {
    this.isLightboxOpen.set(false);
    document.body.style.overflow = 'auto';
  }

  handleImageMouseMove(event: MouseEvent) {
    const card = event.currentTarget as HTMLElement;
    const rect = card.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Calcular rotación (máximo 15 grados)
    const rotateX = ((y - centerY) / centerY) * -15;
    const rotateY = ((x - centerX) / centerX) * 15;
    
    this.tiltX.set(rotateX);
    this.tiltY.set(rotateY);
  }

  resetImageTilt() {
    this.tiltX.set(0);
    this.tiltY.set(0);
    this.isHoveringImg.set(false);
  }

  abrirReporte() {
    if (!this.authStore.isLoggedIn()) {
      this.toast.warning('Inicia sesión para reportar.');
      return;
    }
    this.reporteModal.abrir('OFERTA', this.oferta().id);
  }

  // --- COMENTARIOS: FORMATO Y ACCIONES ---

  formatText(cmd: string) {
    if (cmd === 'bold') {
      document.execCommand('bold', false, undefined);
    } else if (cmd === 'italic') {
      document.execCommand('italic', false, undefined);
    } else if (cmd === 'list') {
      document.execCommand('insertUnorderedList', false, undefined);
    } else if (cmd === 'header') {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        let parent: HTMLElement | null = selection.anchorNode as HTMLElement;
        const rootNode = this.editandoId() ? document.getElementById(`editComposer_${this.editandoId()}`) : this.composer?.nativeElement;
        while (parent && parent.tagName !== 'H3' && parent !== rootNode) {
          parent = parent.parentElement;
        }
        
        if (parent && parent.tagName === 'H3') {
          document.execCommand('formatBlock', false, 'div');
        } else {
          document.execCommand('formatBlock', false, 'h3');
        }
      }
    }
    
    if (this.editandoId()) {
      const editEl = document.getElementById(`editComposer_${this.editandoId()}`);
      if (editEl) editEl.focus();
    } else if (this.composer?.nativeElement) {
      this.composer.nativeElement.focus();
    }
  }

  handleComposerKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const anchorNode = selection.anchorNode;
        const li = anchorNode?.parentElement?.closest('li');
        
        // Si estamos en un LI vacío, al dar Enter salimos de la lista (comportamiento Word)
        if (li && li.textContent?.trim() === '') {
          event.preventDefault();
          document.execCommand('insertUnorderedList', false, undefined);
        }
      }
    }
  }

  addPollOption() {
    if (this.opcionesEncuesta.length < 5) {
      this.opcionesEncuesta.push('');
    }
  }

  togglePollBuilder() {
    this.mostrandoCreadorEncuesta.set(!this.mostrandoCreadorEncuesta());
    if (!this.mostrandoCreadorEncuesta()) {
      this.resetPollData();
    }
  }

  private resetPollData() {
    this.preguntaEncuesta = '';
    this.opcionesEncuesta = ['', ''];
  }

  publicarComentario() {
    const html = this.composer?.nativeElement?.innerHTML || '';
    if (!html.trim() || this.enviandoComentario()) return;
    this.enviandoComentario.set(true);

    let pollJson = null;
    if (this.mostrandoCreadorEncuesta() && this.preguntaEncuesta.trim()) {
      const poll: PollData = {
        question: this.preguntaEncuesta,
        options: this.opcionesEncuesta.filter(o => o.trim()).map(o => ({ text: o, votes: 0 })),
        totalVotes: 0,
        votedUsers: []
      };
      pollJson = JSON.stringify(poll);
    }

    const body = { texto: html, pollJson };
    const params = { ofertaId: this.oferta().id, actorId: this.authStore.user()!.id };

    this.http.post(`${environment.apiUrl}/comentario`, body, { params }).subscribe({
      next: (res: any) => {
        const fullComment = { ...res, poll: res.pollJson ? JSON.parse(res.pollJson) : null };
        this.comentarios.update(list => [fullComment, ...list]);
        
        // Reset composer and poll
        if (this.composer?.nativeElement) this.composer.nativeElement.innerHTML = '';
        this.resetPollData();
        this.mostrandoCreadorEncuesta.set(false);
        this.enviandoComentario.set(false);
      },
      error: () => this.enviandoComentario.set(false)
    });
  }

  borrarComentario(id: number) {
    this.confirmModal.abrir(
      '¿Eliminar comentario?',
      'Esta acción borrará permanentemente tu comentario. ¿Deseas continuar?',
      'DANGER',
      () => {
        this.http.delete(`${environment.apiUrl}/comentario/${id}`).subscribe({
          next: () => this.comentarios.update(list => list.filter(c => c.id !== id))
        });
      }
    );
  }

  iniciarEdicion(c: any) {
    this.editandoId.set(c.id);
    setTimeout(() => {
      const editEl = document.getElementById(`editComposer_${c.id}`);
      if (editEl) editEl.innerHTML = c.texto;
    });
  }

  guardarEdicion() {
    const id = this.editandoId();
    if (!id) return;
    const editEl = document.getElementById(`editComposer_${id}`);
    if (!editEl) return;
    const textoEditado = editEl.innerHTML;
    if (!textoEditado.trim()) return;

    this.http.put(`${environment.apiUrl}/comentario/${id}`, { texto: textoEditado }).subscribe({
      next: (res: any) => {
        this.comentarios.update(list => list.map(c => c.id === id ? { ...c, texto: res.texto } : c));
        this.editandoId.set(null);
      }
    });
  }

  votarEncuesta(comentario: any, index: number) {
    const userId = this.authStore.user()?.id;
    if (!userId) { 
      this.confirmModal.abrir('Inicio de sesión', 'Inicia sesión para participar en encuestas.', 'INFO');
      return; 
    }
    if (comentario.poll.votedUsers?.includes(userId)) { 
      this.confirmModal.abrir('Ya has votado', 'Ya has participado en esta encuesta.', 'INFO');
      return; 
    }

    // Clonar poll para evitar mutaciones directas y actualizar UI
    const updatedPoll = JSON.parse(JSON.stringify(comentario.poll));
    updatedPoll.options[index].votes++;
    updatedPoll.totalVotes++;
    updatedPoll.votedUsers = updatedPoll.votedUsers || [];
    updatedPoll.votedUsers.push(userId);

    const oldPoll = comentario.poll;
    comentario.poll = updatedPoll;

    this.http.put(`${environment.apiUrl}/comentario/${comentario.id}`, { 
      pollJson: JSON.stringify(updatedPoll) 
    }).subscribe({
      error: () => {
        comentario.poll = oldPoll;
        this.toast.error('Error al guardar tu voto.');
      }
    });
  }

  compartir(plataforma: string) {
    const url = window.location.href;
    const text = `¡Vaya chollo en Nexus! ${this.oferta().titulo}`;
    if (plataforma === 'copy') {
      navigator.clipboard.writeText(url);
      this.copiado.set(true);
      setTimeout(() => this.copiado.set(false), 2000);
    }
    if (plataforma === 'wa') window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank');
    if (plataforma === 'tg') window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
  }

  verificarFavorito(ofertaId: number): void {
    if (!this.authStore.isLoggedIn()) return;
    this.favoritoService.getFavoritosIds().subscribe({
      next: (ids: string[]) => this.esFavorito.set(ids.includes(`oferta_${ofertaId}`)),
    });
  }

  toggleFavorito(): void {
    if (!this.authStore.isLoggedIn()) {
      this.toast.info('Inicia sesión para guardar tus favoritos');
      this.guestPopup.showPopup('Para guardar tus chollos favoritos');
      return;
    }

    const ofertaId = this.oferta().id;
    const esFavActual = this.esFavorito();
    this.esFavorito.set(!esFavActual);

    if (!esFavActual) {
      this.favoritoService.addFavorito(ofertaId, 'oferta').subscribe({
        error: () => this.esFavorito.set(esFavActual),
      });
    } else {
      this.favoritoService.removeFavorito(ofertaId, 'oferta').subscribe({
        error: () => this.esFavorito.set(esFavActual),
      });
    }
  }

  get discountPercent(): number {
    const o = this.oferta();
    if (!o || !o.precioOriginal || o.precioOriginal <= o.precioOferta) return 0;
    return Math.round(((o.precioOriginal - o.precioOferta) / o.precioOriginal) * 100);
  }

  get isExpired(): boolean {
    const o = this.oferta();
    if (!o) return false;
    if (o.estado === 'AGOTADA') return true;
    if (!o.fechaExpiracion) return false;
    return new Date(o.fechaExpiracion).getTime() < Date.now();
  }

  get sparkTempWidth(): number {
    const s = this.oferta()?.sparkScore || 0;
    return s <= 0 ? 0 : (s >= 100 ? 100 : s);
  }

  parseMarkdown(text: string): string {
    if (!text) return '';
    // Since we are moving to HTML, we only handle legacy markdown or basic formatting
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n- (.*?)/g, '<li>$1</li>')
      .replace(/### (.*?)\n/g, '<h4>$1</h4>')
      .replace(/\n/g, '<br>');
  }
}
