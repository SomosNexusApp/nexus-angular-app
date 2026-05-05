import { Injectable, signal, computed, HostListener } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class UiService {
  readonly isCategoriasPanelOpen = signal(false);
  readonly isPublishModalOpen = signal(false);
  readonly isAnyChatSelected = signal(false);
  readonly activeChatRoomId = signal<string | null>(null);
  readonly isDetailView = signal(false);
  readonly isMobileUI = signal(window.innerWidth <= 768);

  constructor() {
    window.addEventListener('resize', () => {
      this.isMobileUI.set(window.innerWidth <= 768);
    });
  }

  toggleCategoriasPanel(): void {
    this.isCategoriasPanelOpen.update(v => !v);
  }

  togglePublishModal(): void {
    this.isPublishModalOpen.update(v => !v);
  }

  openCategoriasPanel(): void {
    this.isCategoriasPanelOpen.set(true);
  }

  closeCategoriasPanel(): void {
    this.isCategoriasPanelOpen.set(false);
  }

  closePublishModal(): void {
    this.isPublishModalOpen.set(false);
  }
}
