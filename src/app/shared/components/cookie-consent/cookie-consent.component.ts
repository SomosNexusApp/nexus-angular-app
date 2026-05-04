import { Component, inject, signal, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CookieService } from '../../../core/services/cookie.service';
import { animate, style, transition, trigger } from '@angular/animations';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-cookie-consent',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cookie-consent.component.html',
  styleUrls: ['./cookie-consent.component.scss'],
  animations: [
    trigger('slideInOut', [
      transition(':enter', [
        style({ transform: 'translateY(100%)', opacity: 0 }),
        animate('600ms cubic-bezier(0.16, 1, 0.3, 1)', style({ transform: 'translateY(0)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('400ms cubic-bezier(0.7, 0, 0.84, 0)', style({ transform: 'translateY(100%)', opacity: 0 }))
      ])
    ])
  ]
})
export class CookieConsentComponent implements OnInit {
  cookieService = inject(CookieService);
  showManage = false;
  hasScrolled = signal(false);
  
  // URL dinámica según el entorno
  policyUrl = `${environment.aboutUrl}/legal/cookies`;

  ngOnInit() {
    // Si ya ha aceptado, no necesitamos escuchar el scroll
    if (this.cookieService.consentAccepted()) {
      this.hasScrolled.set(true);
    }
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    if (!this.hasScrolled() && window.scrollY > 300) {
      this.hasScrolled.set(true);
    }
  }

  acceptAll() {
    this.cookieService.acceptCookies();
  }

  toggleManage() {
    this.showManage = !this.showManage;
  }

  savePreferences(analytics: boolean, marketing: boolean) {
    this.cookieService.savePreferences({
      essential: true,
      analytics,
      marketing
    });
  }
}
