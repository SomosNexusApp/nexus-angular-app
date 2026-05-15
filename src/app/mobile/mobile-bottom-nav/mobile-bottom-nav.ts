import { Component, ChangeDetectionStrategy, inject, signal, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthStore } from '../../core/auth/auth-store';
import { GuestPopupService } from '../../core/services/guest-popup.service';
import { UiService } from '../../core/services/ui.service';
import { WebSocketService } from '../../core/services/websocket.service';

@Component({
  selector: 'app-mobile-bottom-nav',
  templateUrl: './mobile-bottom-nav.html',
  styleUrls: ['./mobile-bottom-nav.css'],
  imports: [CommonModule, RouterModule],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MobileBottomNav {
  private router = inject(Router);
  private authStore = inject(AuthStore);
  private guestPopup = inject(GuestPopupService);
  private uiService = inject(UiService);
  public wsService = inject(WebSocketService);

  @ViewChild('navBox') navBox!: ElementRef<HTMLElement>;
  
  orbX = signal(-100);
  orbActive = signal(false);

  onTouchMove(event: TouchEvent) {
    if (event.touches.length > 0) {
      if (!this.orbActive()) this.orbActive.set(true);
      const touch = event.touches[0];
      const navEl = this.navBox.nativeElement;
      const navRect = navEl.getBoundingClientRect();
      
      let x = touch.clientX - navRect.left;
      x = Math.max(0, Math.min(x, navRect.width));
      // Adjust offset center
      this.orbX.set(x - 45); 
    }
  }

  onTouchEnd() {
    this.orbActive.set(false);
  }

  checkAuth(event: Event) {
    if (!this.authStore.isLoggedIn()) {
      event.preventDefault();
      // On mobile, the popup is blocked, so navigate to login directly
      this.router.navigate(['/login']);
    }
  }

  toggleCategories() {
    this.uiService.toggleCategoriasPanel();
  }

  onPublicarClick() {
    if (!this.authStore.isLoggedIn()) {
      this.guestPopup.showPopup();
    } else {
      this.uiService.togglePublishModal();
    }
  }
}

