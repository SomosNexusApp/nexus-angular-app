import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

export type SkeletonCardVariant = 'producto' | 'oferta' | 'vehiculo';

@Component({
  selector: 'app-skeleton-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="sk-card" [ngClass]="'sk-card--' + variant" aria-hidden="true">
      <div class="sk-img"></div>
      <div class="sk-body">
        <div class="sk-line sk-title"></div>
        <div class="sk-line sk-title sk-short"></div>
        <div class="sk-line sk-price"></div>
        @if (variant === 'oferta') {
          <div class="sk-vote-row">
            <div class="sk-btn"></div>
            <div class="sk-btn"></div>
          </div>
        }
        @if (variant === 'vehiculo') {
          <div class="sk-chips">
            <div class="sk-chip"></div>
            <div class="sk-chip"></div>
            <div class="sk-chip"></div>
          </div>
        }
        <div class="sk-footer">
          <div class="sk-line sk-loc"></div>
          <div class="sk-line sk-time"></div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
      }

      .sk-card {
        background: #121212;
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 16px;
        overflow: hidden;
        height: 100%;
        display: flex;
        flex-direction: column;
      }

      /* Shades para las distintas variantes */
      .sk-img {
        width: 100%;
        background: #1a1a1a;
      }
      .sk-card--producto .sk-img {
        padding-top: 90%;
      }
      .sk-card--oferta .sk-img {
        padding-top: 75%;
      }
      .sk-card--vehiculo .sk-img {
        padding-top: 55%;
      }

      .sk-body {
        padding: 10px 14px 12px;
        display: flex;
        flex-direction: column;
        flex-grow: 1;
        gap: 8px;
      }

      /* Shimmer base */
      .sk-img,
      .sk-line,
      .sk-btn,
      .sk-chip {
        background: linear-gradient(90deg, #181818 25%, #252525 50%, #181818 75%);
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite ease-in-out;
        border-radius: 6px;
      }

      .sk-line {
        height: 12px;
      }
      .sk-title {
        height: 13px;
        width: 85%;
      }
      .sk-short {
        width: 55%;
      }
      .sk-price {
        height: 22px;
        width: 40%;
        border-radius: 8px;
      }
      .sk-loc {
        height: 11px;
        width: 40%;
      }
      .sk-time {
        height: 11px;
        width: 25%;
      }

      .sk-footer {
        display: flex;
        justify-content: space-between;
        margin-top: auto;
        padding-top: 8px;
        border-top: 1px solid rgba(255, 255, 255, 0.04);
      }

      .sk-vote-row {
        display: flex;
        gap: 8px;
      }
      .sk-btn {
        height: 30px;
        width: 70px;
        border-radius: 20px;
      }

      .sk-chips {
        display: flex;
        gap: 6px;
      }
      .sk-chip {
        height: 22px;
        width: 60px;
        border-radius: 20px;
      }

      @keyframes shimmer {
        0% {
          background-position: 200% 0;
        }
        100% {
          background-position: -200% 0;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SkeletonCardComponent {
  @Input() variant: SkeletonCardVariant = 'producto';
}
