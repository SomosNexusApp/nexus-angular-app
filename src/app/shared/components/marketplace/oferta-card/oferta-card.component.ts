import {
  Component,
  Input,
  ChangeDetectionStrategy,
  inject,
  signal,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { CurrencyEsPipe } from '../../../pipes/currency-es.pipe';
import { TimeAgoPipe } from '../../../pipes/time-ago.pipe';
import { SkeletonCardComponent } from '../../skeleton-card/skeleton-card.component';
import { CoverImagePipe } from '../../../pipes/cover-image.pipe';
import { MarketplaceItem } from '../../../../models/marketplace-item.model';
import { environment } from '../../../../../environments/environment';
import { AuthStore } from '../../../../core/auth/auth-store';
import { ToastService } from '../../../../core/services/toast.service';
import { FavoritoService } from '../../../../core/services/favorito.service';
import { createFriendlySlug } from '../../../../shared/utils/slug-utils';

@Component({
  selector: 'app-oferta-card',
  standalone: true,
  imports: [CommonModule, RouterModule, CurrencyEsPipe, TimeAgoPipe, SkeletonCardComponent],
  templateUrl: './oferta-card.component.html',
  styleUrls: ['./oferta-card.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfertaCardComponent implements OnInit, OnDestroy, OnChanges {
  @Input() oferta!: MarketplaceItem;
  @Input() isSkeleton = false;
  @Input() isMobileFeed = false;

  private router = inject(Router);
  private http = inject(HttpClient);
  private authStore = inject(AuthStore);
  private cdr = inject(ChangeDetectorRef);
  private toast = inject(ToastService);
  private favService = inject(FavoritoService);

  // Estados locales para reactividad inmediata
  sparkScore = signal(0);
  miVoto = signal<string | null>(null); // 'SPARK', 'DRIP' o 'NONE'
  esFavorito = signal(false);
  animandoCorazon = signal(false);
  votando = signal(false);
  copiado = signal(false);
  countdown = signal('');

  private countdownInterval?: ReturnType<typeof setInterval>;

  get isLoggedIn(): boolean {
    return this.authStore.isLoggedIn();
  }

  get discountPercent(): number {
    const orig = this.oferta?.precioOriginal;
    const off = this.oferta?.precioOferta || this.oferta?.precio;
    if (!orig || !off || orig <= off) return 0;
    return Math.round(((orig - off) / orig) * 100);
  }

  get tiendaReal(): string {
    const t = (this.oferta as any).tienda;
    if (t && t.trim() && t !== 'Tienda') return t;

    const url = (this.oferta as any).urlOferta || (this.oferta as any).urlExterna;
    if (url) {
      try {
        const domain = new URL(url).hostname.replace('www.', '');
        // Mapeo inteligente de dominios comunes para que salgan bien (Capitalizados)
        const parts = domain.split('.');
        const name = parts[0]; // ej: mediamarkt de mediamarkt.es
        
        // Formateo especial para marcas conocidas
        const map: Record<string, string> = {
          'mediamarkt': 'MediaMarkt',
          'amazon': 'Amazon',
          'ebay': 'eBay',
          'aliexpress': 'AliExpress',
          'elcorteingles': 'El Corte Inglés',
          'pccomponentes': 'PcComponentes',
          'chollometro': 'Chollometro',
          'showroomprive': 'Showroomprivé'
        };

        return map[name.toLowerCase()] || (name.charAt(0).toUpperCase() + name.slice(1));
      } catch (e) {
        return (this.oferta as any).tienda || 'Particular';
      }
    }
    return (this.oferta as any).tienda || 'Particular';
  }

  get badgeLabel(): string {
    const map: Record<string, string> = {
      CHOLLAZO: 'CHOLLAZO',
      EXPIRA_HOY: 'EXPIRA HOY',
      GRATUITA: 'GRATIS',
      NUEVA: 'NUEVA',
      DESTACADA: 'DESTACADA',
      PORCENTAJE: 'OFERTA',
    };
    const b = (this.oferta as any)?.badge;
    return b ? map[b] || b : '';
  }

  get sparkTempWidth(): number {
    const score = this.sparkScore();
    if (score <= 0) return 0;
    if (score >= 100) return 100;
    return score;
  }

  get expiraProxima(): boolean {
    const fe = (this.oferta as any)?.fechaExpiracion;
    if (!fe) return false;
    const diff = new Date(fe).getTime() - Date.now();
    return diff > 0 && diff < 24 * 3600 * 1000;
  }

  get isExpired(): boolean {
    const fe = (this.oferta as any)?.fechaExpiracion;
    if (!fe) return false;
    return new Date(fe).getTime() < Date.now();
  }

  ngOnInit(): void {
    if (this.oferta) {
      this.updateState();
      this.checkFavorito();
    }
  }

  private checkFavorito(): void {
    if (this.isLoggedIn && this.oferta?.id) {
       this.favService.getFavoritosIds().subscribe(ids => {
         this.esFavorito.set(ids.includes(`oferta_${this.oferta.id}`));
       });
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['oferta'] && this.oferta) {
      this.updateState();
    }
  }

  private updateState(): void {
    this.sparkScore.set((this.oferta as any).sparkScore ?? 0);
    this.miVoto.set((this.oferta as any).miVoto || 'NONE');

    if (this.countdownInterval) clearInterval(this.countdownInterval);
    if ((this.oferta as any).fechaExpiracion) this.startCountdown();
  }

  ngOnDestroy(): void {
    if (this.countdownInterval) clearInterval(this.countdownInterval);
  }

  private startCountdown(): void {
    const update = () => {
      const fe = (this.oferta as any).fechaExpiracion;
      const diff = new Date(fe).getTime() - Date.now();
      if (diff <= 0) {
        this.countdown.set('Expirada');
        clearInterval(this.countdownInterval);
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      this.countdown.set(h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`);
    };
    update();
    this.countdownInterval = setInterval(update, 1000);
  }

  votar(esSpark: boolean, event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();

    if (!this.isLoggedIn) {
      this.toast.warning('Inicia sesión para votar ofertas.');
      return;
    }

    if (this.votando() || this.oferta.id === 9999) return;

    const usuarioId = this.authStore.user()?.id;
    if (!usuarioId) return;

    this.votando.set(true);

    // Guardar estado anterior por si falla
    const previousScore = this.sparkScore();
    const previousVoto = this.miVoto();
    const voteType = esSpark ? 'SPARK' : 'DRIP';

    // Calculo optimista
    let newScore = previousScore;
    let newVoto = previousVoto;

    // Deshacer voto anterior si lo había
    if (previousVoto === 'SPARK') newScore -= 1;
    else if (previousVoto === 'DRIP') newScore -= -1;

    if (previousVoto === voteType) {
      // Quitar voto
      newVoto = 'NONE';
    } else {
      // Agregar nuevo voto
      newVoto = voteType;
      if (newVoto === 'SPARK') newScore += 1;
      else if (newVoto === 'DRIP') newScore += -1;
    }

    // Aplicar cambios optimistas en los signals locales
    this.sparkScore.set(newScore);
    this.miVoto.set(newVoto);

    // Sincronizar también el objeto oferta por si se usa fuera
    (this.oferta as any).sparkScore = newScore;
    (this.oferta as any).miVoto = newVoto;

    const params = new HttpParams()
      .set('usuarioId', usuarioId.toString())
      .set('esSpark', esSpark.toString());

    this.http
      .post(`${environment.apiUrl}/oferta/${this.oferta.id}/votar`, {}, { params })
      .subscribe({
        next: (res: any) => {
          this.votando.set(false);

          // Log para depuración en producción/desarrollo
          console.log(
            `[Voto Fix] Oferta ${this.oferta.id}: Score devuelto=${res.sparkScore}, MiVoto=${res.miVoto}`,
          );

          // Actualizar signals con la confirmación real del servidor (ya no debería haber "bounce")
          this.sparkScore.set(res.sparkScore);
          this.miVoto.set(res.miVoto);

          // Sincronizar objeto original
          (this.oferta as any).sparkScore = res.sparkScore;
          (this.oferta as any).badge = res.badge;
          (this.oferta as any).miVoto = res.miVoto;

          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error al votar:', err);
          this.sparkScore.set(previousScore);
          this.miVoto.set(previousVoto);
          (this.oferta as any).sparkScore = previousScore;
          (this.oferta as any).miVoto = previousVoto;
          this.votando.set(false);
        },
      });
  }

  copiarCodigo(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    const code = (this.oferta as any).codigoDescuento;
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      this.copiado.set(true);
      setTimeout(() => this.copiado.set(false), 2000);
    });
  }

  irALaOferta(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    const url = (this.oferta as any).urlOferta || (this.oferta as any).urlExterna;
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      this.navigateToDetail();
    }
  }

  navigateToDetail(): void {
    if (this.oferta.id === 9999) return;
    const slug = createFriendlySlug(this.oferta.titulo, this.oferta.id);
    this.router.navigate(['/ofertas', slug]);
  }

  toggleFavorito(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();

    if (!this.isLoggedIn) {
      this.toast.warning('Inicia sesión para guardar favoritos.');
      return;
    }

    const id = this.oferta.id;
    if (!id || id === 9999) return;

    this.animandoCorazon.set(true);
    const becomingFav = !this.esFavorito();
    
    // Update local state early for responsiveness
    this.esFavorito.set(becomingFav);

    const req = becomingFav ? this.favService.addFavorito(id, 'oferta') : this.favService.removeFavorito(id, 'oferta');

    req.subscribe({
      error: () => {
        this.esFavorito.set(!becomingFav);
      },
      complete: () => {
        setTimeout(() => this.animandoCorazon.set(false), 400);
      }
    });
  }
}
