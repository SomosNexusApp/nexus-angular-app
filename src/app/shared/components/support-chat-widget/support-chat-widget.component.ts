import {
  Component,
  inject,
  signal,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd, RouterLink } from '@angular/router';
import { filter, interval, Subscription } from 'rxjs';
import { SupportChatService, SoporteMsg } from '../../../core/services/support-chat.service';
import { AuthStore } from '../../../core/auth/auth-store';
import { GuestPopupService } from '../../../core/services/guest-popup.service';
import { SlugPipe } from '../../../shared/pipes/slug-pipe';

@Component({
  selector: 'app-support-chat-widget',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SlugPipe],
  templateUrl: './support-chat-widget.component.html',
  styleUrls: ['./support-chat-widget.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportChatWidgetComponent implements OnDestroy {
  private support = inject(SupportChatService);
  private router = inject(Router);
  private auth = inject(AuthStore);
  private cdr = inject(ChangeDetectorRef);
  private guestPopup = inject(GuestPopupService);

  open = signal(false);
  loading = signal(false);
  mensajes = signal<SoporteMsg[]>([]);
  input = '';
  sessionToken = signal<string | null>(localStorage.getItem('nexus_soporte_token'));
  
  // Status & Survey
  status = signal<string>('OPEN');
  humanTakeover = signal(false);
  escalationEmail = signal<string | null>(null);
  surveyRating = signal(0);
  surveyComment = '';
  surveySent = signal(false);
  isTyping = signal(false);
  isRegisterPage = signal(false);

  hideOnAdmin = signal(false);

  private pollSub: Subscription | null = null;
  private navSub: Subscription;

  constructor() {
    this.navSub = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => {
        const url = this.router.url;
        this.hideOnAdmin.set(url.includes('/admin'));
        this.isRegisterPage.set(url.includes('/register'));
        this.cdr.markForCheck();
      });
    const url = this.router.url;
    this.hideOnAdmin.set(url.includes('/admin'));
    this.isRegisterPage.set(url.includes('/register'));
  }

  ngOnDestroy(): void {
    this.navSub.unsubscribe();
    this.stopPoll();
  }

  toggle(): void {
    if (!this.auth.isLoggedIn()) {
      this.guestPopup.showPopup();
      return;
    }

    this.open.update((v) => !v);
    if (this.open() && !this.sessionToken()) {
      this.iniciarSesion();
    } else if (this.open() && this.sessionToken()) {
      this.refrescarMensajes();
      this.startPoll();
    } else {
      this.stopPoll();
    }
  }

  private iniciarSesion(): void {
    this.loading.set(true);
    const uid = this.auth.user()?.id;
    this.support.crearSesion(uid).subscribe({
      next: (r) => {
        localStorage.setItem('nexus_soporte_token', r.sessionToken);
        this.sessionToken.set(r.sessionToken);
        this.status.set(r.status);
        this.mensajes.set(r.mensajes || []);
        this.loading.set(false);
        this.startPoll();
        setTimeout(() => this.scrollToBottom(), 200);
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading.set(false);
        this.cdr.markForCheck();
      },
    });
  }

  enviar(): void {
    const t = this.input.trim();
    const tok = this.sessionToken();
    if (!t || !tok || this.status() === 'CLOSED' || this.isTyping()) return;

    // Optimistic Update
    const tempMsg: SoporteMsg = {
      id: Date.now(),
      rol: 'USER',
      contenido: t,
      creadoEn: new Date().toISOString()
    };
    this.mensajes.update(prev => [...prev, tempMsg]);
    this.input = '';
    this.isTyping.set(true);
    
    // Force immediate render and scroll
    this.cdr.detectChanges();
    this.scrollToBottom();

    this.support.enviar(tok, t).subscribe({
      next: (r) => {
        this.isTyping.set(false);
        this.mensajes.set(r.mensajes || []);
        this.status.set(r.status);
        if (r.humanTakeover) this.humanTakeover.set(true);
        if (r.escalationEmail) this.escalationEmail.set(r.escalationEmail);
        setTimeout(() => this.scrollToBottom(), 50);
        this.cdr.markForCheck();
      },
      error: () => {
        this.isTyping.set(false);
        this.cdr.markForCheck();
      }
    });
  }

  enviarEncuesta(): void {
    const tok = this.sessionToken();
    const rating = this.surveyRating();
    if (!tok || rating === 0) return;

    this.support.enviarEncuesta(tok, rating, this.surveyComment).subscribe(() => {
      this.surveySent.set(true);
      this.status.set('CLOSED');
      this.cdr.markForCheck();
    });
  }

  reiniciarChat(): void {
    localStorage.removeItem('nexus_soporte_token');
    this.sessionToken.set(null);
    this.mensajes.set([]);
    this.status.set('OPEN');
    this.surveySent.set(false);
    this.surveyRating.set(0);
    this.surveyComment = '';
    this.humanTakeover.set(false);
    this.escalationEmail.set(null);
    this.isTyping.set(false);
    
    this.iniciarSesion();
    this.cdr.markForCheck();
  }

  private refrescarMensajes(): void {
    const tok = this.sessionToken();
    if (!tok || this.isTyping()) return; // SKIP while AI is typing to avoid lag/overwrite

    this.support.poll(tok).subscribe({
      next: (m) => {
        // Only update if typing is finished to prevent overwriting optimistic state
        if (this.isTyping()) return;
        
        const changed = this.mensajes().length !== m.length;
        this.mensajes.set(m);
        if (changed) {
          setTimeout(() => this.scrollToBottom(), 50);
        }
        this.cdr.markForCheck();
      },
      error: () => {
        localStorage.removeItem('nexus_soporte_token');
        this.sessionToken.set(null);
        this.status.set('CLOSED');
        this.cdr.markForCheck();
      }
    });
  }

  private scrollToBottom(): void {
    const el = document.querySelector('.scw-messages');
    if (el) el.scrollTop = el.scrollHeight;
  }

  private startPoll(): void {
    this.stopPoll();
    this.pollSub = interval(4000).subscribe(() => {
      if (this.open() && this.sessionToken()) this.refrescarMensajes();
    });
  }

  private stopPoll(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = null;
  }
}
