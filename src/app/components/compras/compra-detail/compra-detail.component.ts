import { Component, inject, OnInit, signal, computed, ViewChild } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { CompraService } from '../../../core/services/compra.service';
import { AuthStore } from '../../../core/auth/auth-store';
import { Compra } from '../../../models/compra.model';
import { TimeAgoPipe } from '../../../shared/pipes/time-ago.pipe';
import { CurrencyEsPipe } from '../../../shared/pipes/currency-es.pipe';
import { CoverImagePipe } from '../../../shared/pipes/cover-image.pipe';
import { SlugPipe } from '../../../shared/pipes/slug-pipe';
import { ValoracionModalComponent } from '../../../shared/components/valoracion-modal/valoracion-modal.component';

@Component({
  selector: 'app-compra-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, CurrencyEsPipe, CoverImagePipe, ValoracionModalComponent, SlugPipe],
  templateUrl: './compra-detail.component.html',
  styleUrl: './compra-detail.component.css',
})
export class CompraDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private compraSrv = inject(CompraService);
  private authStore = inject(AuthStore);

  compra = signal<Compra | null>(null);
  envioInfo = signal<any>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  @ViewChild(ValoracionModalComponent) valoracionModal!: ValoracionModalComponent;

  currentUser = this.authStore.user;

  esComprador = computed(() => {
    const c = this.compra();
    const u = this.currentUser();
    return c && u && c.comprador?.id === u.id;
  });

  esVendedor = computed(() => {
    const c = this.compra();
    const u = this.currentUser();
    return c && u && c.producto?.vendedor?.id === u.id;
  });

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      const idStr = params.get('id');
      if (idStr) {
        this.cargarCompra(parseInt(idStr, 10));
      }
    });
  }

  cargarCompra(id: number) {
    this.loading.set(true);
    this.compraSrv.getCompra(id).subscribe({
      next: (data) => {
        this.compra.set(data);
        if (data.estado !== 'PENDIENTE' && data.metodoEntrega === 'ENVIO_PAQUETERIA') {
          this.cargarEnvio(id);
        } else {
          this.loading.set(false);
        }
      },
      error: (err) => {
        this.error.set('No se pudo cargar la información de tu compra.');
        this.loading.set(false);
      },
    });
  }

  cargarEnvio(compraId: number) {
    this.compraSrv.getEnvioPorCompra(compraId).subscribe({
      next: (envio) => {
        this.envioInfo.set(envio);
        this.loading.set(false);
      },
      error: () => {
        // Puede no haber envío todavía
        this.loading.set(false);
      },
    });
  }

  volver() {
    this.location.back();
  }

  getBadgeColor(estado: string): string {
    switch (estado) {
      case 'PENDIENTE':
        return '#9ca3af'; // gris
      case 'PAGADO':
        return '#3b82f6'; // azul
      case 'ENVIADO':
        return '#06b6d4'; // cyan
      case 'EN_TRANSITO':
        return '#1d4ed8'; // azul oscuro
      case 'ENTREGADO':
        return '#eab308'; // amarillo
      case 'COMPLETADA':
        return '#22c55e'; // verde
      case 'CANCELADA':
        return '#ef4444'; // rojo
      case 'REEMBOLSADA':
        return '#a855f7'; // morado
      case 'EN_DISPUTA':
        return '#f97316'; // naranja
      default:
        return '#6b7280';
    }
  }

  getTimelineSteps() {
    const c = this.compra();
    if (!c) return [];

    const steps = [
      { id: 'PENDIENTE', label: 'Pago Inicial' },
      { id: 'PAGADO', label: 'Pago Confirmado' },
      { id: 'ENVIADO', label: 'Enviado' },
      { id: 'ENTREGADO', label: 'Entregado' },
      { id: 'COMPLETADA', label: 'Completada' },
    ];

    let currentFound = false;
    return steps.map((s) => {
      const isPastOrCurrent = !currentFound;
      if (s.id === c.estado) currentFound = true;
      return {
        ...s,
        active: isPastOrCurrent,
        current: s.id === c.estado,
      };
    });
  }

  calcProgressWidth(): string {
    const steps = this.getTimelineSteps();
    const activeIndex = [...steps].reverse().findIndex(s => s.active);
    if (activeIndex === -1) return '0%';
    
    const realIndex = (steps.length - 1) - activeIndex;
    const percentage = (realIndex / (steps.length - 1)) * 100;
    return `${percentage}%`;
  }

  abrirValoracion() {
    const c = this.compra();
    if (c && c.producto?.vendedor?.user) {
      this.valoracionModal.abrir(c.producto.vendedor.user, c.id);
    }
  }
}
