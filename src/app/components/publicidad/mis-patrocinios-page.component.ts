import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { AuthStore } from '../../core/auth/auth-store';
import { environment } from '../../../environments/environment';
import { ToastService } from '../../core/services/toast.service';

interface ItemPreview { id: number; titulo: string; imagen?: string; tipo: 'PRODUCTO' | 'OFERTA' | 'VEHICULO'; }
interface Patrocinio {
  id: number; tipoItem: string; itemId: number; itemTitulo: string; itemImagen?: string;
  estado: string; monto?: number; diasPatrocinio?: number; fecha: string; fechaFin?: string;
}

@Component({
  selector: 'app-mis-patrocinios-page',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './mis-patrocinios-page.component.html',
  styleUrls: ['./mis-patrocinios-page.component.css'],
})
export class MisPatrociniosPageComponent implements OnInit {
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  authStore = inject(AuthStore);
  user = this.authStore.user;

  // Tabs
  activeTab = signal<'solicitar' | 'mis-solicitudes'>('solicitar');

  // Solicitar form
  tipoSeleccionado = signal<'PRODUCTO' | 'OFERTA' | 'VEHICULO'>('PRODUCTO');
  items = signal<ItemPreview[]>([]);
  cargandoItems = signal(false);
  itemSeleccionado = signal<ItemPreview | null>(null);
  diasPatrocinio = signal<number>(30);
  precioEstimado = signal<number | null>(null);
  enviando = signal(false);
  paso = signal<1 | 2 | 3>(1); // 1=elegir tipo, 2=elegir item, 3=confirmar

  // Mis solicitudes
  patrocinios = signal<Patrocinio[]>([]);
  cargandoPatrocinios = signal(false);

  // Pago
  pagePaySuccess = signal(false);
  pagePayCancel = signal(false);

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['pago'] === 'ok') this.pagePaySuccess.set(true);
      if (params['pago'] === 'cancel') this.pagePayCancel.set(true);
    });
    this.cargarPatrocinios();
    this.cargarItems();
  }

  cargarItems() {
    const u = this.user();
    if (!u) return;
    this.cargandoItems.set(true);
    const tipo = this.tipoSeleccionado();
    let url = '';
    if (tipo === 'PRODUCTO') url = `${environment.apiUrl}/producto/filtrar?vendedorId=${u.id}&tamano=50`;
    else if (tipo === 'OFERTA') url = `${environment.apiUrl}/oferta/filtrar?vendedorId=${u.id}&tamano=50`;
    else url = `${environment.apiUrl}/vehiculo/usuario/${u.id}`;

    this.http.get<any>(url).subscribe({
      next: (res) => {
        let lista = Array.isArray(res) ? res : (res?.contenido ?? res?.content ?? []);
        this.items.set(lista.map((item: any) => ({
          id: item.id,
          titulo: tipo === 'VEHICULO' ? `${item.marca} ${item.modelo} (${item.anio})` : item.titulo,
          imagen: item.imagenPrincipal,
          tipo
        })));
        this.cargandoItems.set(false);
      },
      error: () => this.cargandoItems.set(false)
    });
  }

  onTipoChange(tipo: 'PRODUCTO' | 'OFERTA' | 'VEHICULO') {
    this.tipoSeleccionado.set(tipo);
    this.itemSeleccionado.set(null);
    this.cargarItems();
  }

  seleccionarItem(item: ItemPreview) {
    this.itemSeleccionado.set(item);
    this.paso.set(3);
  }

  volverAlista() {
    this.itemSeleccionado.set(null);
    this.paso.set(2);
  }

  irAPaso2() { this.paso.set(2); }

  enviarSolicitud() {
    const item = this.itemSeleccionado();
    if (!item) return;
    this.enviando.set(true);
    this.http.post<any>(`${environment.apiUrl}/api/patrocinios/solicitar`, {
      tipoItem: item.tipo,
      itemId: item.id,
      diasPatrocinio: this.diasPatrocinio(),
      precioEstimado: this.precioEstimado()
    }).subscribe({
      next: (res) => {
        this.toast.success(res.mensaje || '¡Solicitud enviada! Te avisaremos cuando el equipo la revise.');
        this.enviando.set(false);
        this.paso.set(1);
        this.itemSeleccionado.set(null);
        this.activeTab.set('mis-solicitudes');
        this.cargarPatrocinios();
      },
      error: (e) => {
        this.toast.error(e?.error?.error || 'Error al enviar la solicitud');
        this.enviando.set(false);
      }
    });
  }

  cargarPatrocinios() {
    this.cargandoPatrocinios.set(true);
    this.http.get<Patrocinio[]>(`${environment.apiUrl}/api/patrocinios/mis-patrocinios`).subscribe({
      next: (res) => { this.patrocinios.set(res || []); this.cargandoPatrocinios.set(false); },
      error: () => this.cargandoPatrocinios.set(false)
    });
  }

  pagarPatrocinio(id: number) {
    this.http.post<any>(`${environment.apiUrl}/api/patrocinios/${id}/pagar`, {}).subscribe({
      next: (res) => { if (res.checkoutUrl) window.location.href = res.checkoutUrl; },
      error: (e) => this.toast.error(e?.error?.error || 'Error al iniciar el pago')
    });
  }

  getEstadoLabel(estado: string): string {
    const map: Record<string, string> = {
      SOLICITUD_USUARIO: 'En revisión',
      APROBADO_PENDIENTE_PAGO: 'Aprobado · Pago pendiente',
      PENDIENTE_PAGO: 'Procesando pago',
      ACTIVE: 'Activo ✓',
      CANCELLED: 'Cancelado',
      RECHAZADO: 'No aprobado',
      EXPIRED: 'Expirado'
    };
    return map[estado] || estado;
  }

  getEstadoClass(estado: string): string {
    if (estado === 'ACTIVE') return 'badge-active';
    if (estado === 'APROBADO_PENDIENTE_PAGO') return 'badge-approved';
    if (estado === 'SOLICITUD_USUARIO') return 'badge-pending';
    if (estado === 'CANCELLED' || estado === 'RECHAZADO') return 'badge-cancelled';
    return 'badge-neutral';
  }

  getItemRouterLink(p: Patrocinio): string[] {
    if (p.tipoItem === 'PRODUCTO') return ['/productos', String(p.itemId)];
    if (p.tipoItem === 'OFERTA') return ['/ofertas', String(p.itemId)];
    return ['/vehiculos', String(p.itemId)];
  }

  diasOptions = [7, 14, 30, 60, 90];
}
