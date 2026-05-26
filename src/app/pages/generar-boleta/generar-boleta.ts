import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminLayoutComponent } from '../../layout/admin-layout/admin-layout';
import { TelefonoDireccionService } from '../../core/services/telefono-direccion.service/telefono-direccion.service';
import { DashboardService } from '../../core/services/dashboard.service/dashboard';
import { BoletaService } from '../../core/services/boleta.service/boleta.service';
import { PriceService } from '../../core/services/price.service/price.service';
import { iTelefonoDireccion } from '../../core/model/telefonoDireccion/i-telefono-direccion';
import { IPedido } from '../../core/model/pedido/i-pedido';
import { IBoleta } from '../../core/model/boleta/i-boleta';
import { IPrecio } from '../../core/model/precio/i-precio';

interface BolsaMap {
  tipo: string;
  campo: keyof IPedido;
  divisor: number;
}

@Component({
  selector: 'app-generar-boleta',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminLayoutComponent],
  templateUrl: './generar-boleta.html',
  styleUrls: ['./generar-boleta.css']
})
export class GenerarBoletaComponent implements OnInit {

  private readonly BOLSAS: BolsaMap[] = [
    { tipo: '1,5kg',     campo: 'kg1_5',     divisor: 10 },
    { tipo: '2,5kg',     campo: 'kg2_5',     divisor: 7  },
    { tipo: '4,5kg',     campo: 'kg4_5',     divisor: 4  },
    { tipo: '10kg',      campo: 'kg10_5',    divisor: 1  },
    { tipo: 'Triturado', campo: 'triturado', divisor: 1  },
  ];

  // Búsqueda
  telefono = '';
  buscando = false;
  errorBusqueda = '';

  // Direcciones
  direcciones: iTelefonoDireccion[] = [];
  direccionSeleccionada: iTelefonoDireccion | null = null;

  // Pedidos del cliente
  pedidos: IPedido[] = [];
  cargandoPedidos = false;

  // Precios
  private precios: IPrecio[] = [];

  // Estado boleta
  pedidoEnProceso: IPedido | null = null;
  generando = false;
  mensajeError = '';
  boletasGeneradas = new Set<number>();
  boletasExistentes = new Set<number>();

  // Comprobante
  boletaGuardada: IBoleta | null = null;
  modalComprobanteAbierto = false;
  comprobanteImgUrl: string | null = null;
  compartiendo = false;

  constructor(
    private telefonoDireccionService: TelefonoDireccionService,
    private dashboardService: DashboardService,
    private boletaService: BoletaService,
    private priceService: PriceService
  ) {}

  ngOnInit(): void {
    this.priceService.obtenerPrecios().subscribe({
      next: (res) => { if (res.success) this.precios = res.data; }
    });
  }

  buscar(): void {
    const tel = this.telefono.trim();
    if (!tel) return;
    this.buscando = true;
    this.errorBusqueda = '';
    this.direcciones = [];
    this.direccionSeleccionada = null;
    this.pedidos = [];
    this.boletasGeneradas.clear();

    this.telefonoDireccionService.obtenerDirecciones(tel).subscribe({
      next: (res) => {
        this.buscando = false;
        if (res.success && res.data?.length > 0) {
          this.direcciones = res.data;
          if (res.data.length === 1) this.direccionSeleccionada = res.data[0];
          this.cargarPedidos();
        } else {
          this.errorBusqueda = 'No se encontró el cliente con ese teléfono.';
        }
      },
      error: () => {
        this.buscando = false;
        this.errorBusqueda = 'Error al buscar el cliente.';
      }
    });
  }

  cargarPedidos(): void {
    const tel = this.telefono.trim();
    if (!tel) return;
    this.cargandoPedidos = true;
    this.pedidos = [];
    this.boletasExistentes.clear();

    this.dashboardService.filtrarPedidos({ telefono: tel, tamañoPagina: 10 }).subscribe({
      next: (res) => {
        this.cargandoPedidos = false;
        if (res.success && res.data?.items) this.pedidos = res.data.items;
      },
      error: () => { this.cargandoPedidos = false; }
    });

    this.boletaService.getByTelefono(tel).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.boletasExistentes = new Set(
            res.data.filter(b => b.pedidoId != null).map(b => b.pedidoId!)
          );
        }
      }
    });
  }

  yaGenerada(pedido: IPedido): boolean {
    return !!(pedido.id && (this.boletasGeneradas.has(pedido.id) || this.boletasExistentes.has(pedido.id)));
  }

  getItemsPedido(pedido: IPedido): { tipo: string; cantidad: number; precioUnit: number; subtotal: number }[] {
    return this.BOLSAS
      .filter(b => (pedido[b.campo] as number) > 0)
      .map(b => {
        const cantidad = pedido[b.campo] as number;
        const precioUnit = this.getPrecioUnitario(b.tipo, b.divisor);
        return { tipo: b.tipo, cantidad, precioUnit, subtotal: cantidad * precioUnit };
      });
  }

  private getPrecioUnitario(tipo: string, divisor: number): number {
    const precio = this.precios.find(p => p.tipoBolsa === tipo);
    return precio ? precio.precio1 / divisor : 0;
  }

  getTotalPedido(pedido: IPedido): number {
    return parseFloat(pedido.precio_Total) || 0;
  }

  formatFecha(fecha: string): string {
    if (!fecha) return '-';
    return new Date(fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  generarBoleta(pedido: IPedido): void {
    if (!this.direccionSeleccionada) {
      this.mensajeError = 'Seleccioná una dirección primero.';
      return;
    }
    // Bloqueo optimista inmediato: evita doble click antes de que Angular re-renderice
    if (this.yaGenerada(pedido)) return;
    if (pedido.id) this.boletasGeneradas.add(pedido.id);

    this.pedidoEnProceso = pedido;
    this.generando = true;
    this.mensajeError = '';

    const items = this.getItemsPedido(pedido);
    const importeCalculado = items.reduce((acc, i) => acc + i.subtotal, 0);
    const importeReal = parseFloat(pedido.precio_Total) || importeCalculado;
    const tieneDescuento = Math.abs(importeReal - importeCalculado) > 0.5;

    const boleta: IBoleta = {
      pedidoId: pedido.id,
      telefono: this.telefono.trim(),
      direccion: this.direccionSeleccionada.direccion,
      fechaBoleta: (pedido.fecha_Carga ?? new Date().toISOString()).split('T')[0],
      importeTotal: importeCalculado,
      importeConDescuento: tieneDescuento ? importeReal : undefined,
      estado: 'Pendiente',
      items: items.map(i => ({
        tipoBolsa: i.tipo,
        cantidad: i.cantidad,
        precioUnitario: i.precioUnit,
        subtotal: i.subtotal
      }))
    };

    this.boletaService.crear(boleta).subscribe({
      next: (res) => {
        this.generando = false;
        if (res.success) {
          if (pedido.id) this.boletasExistentes.add(pedido.id);
          this.abrirComprobante(res.data);
        } else {
          // Rollback: habilitar el botón si la API rechazó la creación
          if (pedido.id) this.boletasGeneradas.delete(pedido.id);
          this.mensajeError = res.message || 'Error al guardar la boleta.';
          this.pedidoEnProceso = null;
        }
      },
      error: () => {
        // Rollback: habilitar el botón si hubo error de red
        if (pedido.id) this.boletasGeneradas.delete(pedido.id);
        this.generando = false;
        this.mensajeError = 'Error al guardar la boleta.';
        this.pedidoEnProceso = null;
      }
    });
  }

  abrirComprobante(boleta: IBoleta): void {
    this.boletaGuardada = boleta;
    this.generarImagen(boleta).then(blob => {
      if (this.comprobanteImgUrl) URL.revokeObjectURL(this.comprobanteImgUrl);
      this.comprobanteImgUrl = URL.createObjectURL(blob);
      this.modalComprobanteAbierto = true;
    });
  }

  cerrarComprobante(): void {
    this.modalComprobanteAbierto = false;
    if (this.comprobanteImgUrl) {
      URL.revokeObjectURL(this.comprobanteImgUrl);
      this.comprobanteImgUrl = null;
    }
    this.boletaGuardada = null;
    this.pedidoEnProceso = null;
  }

  async compartirWhatsApp(): Promise<void> {
    if (!this.boletaGuardada) return;
    this.compartiendo = true;
    try {
      const blob = await this.generarImagen(this.boletaGuardada);
      const file = new File([blob], 'comprobante-deuda.png', { type: 'image/png' });
      const nav = navigator as any;
      if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: 'Comprobante de deuda - Hielo Fres-Cor' });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'comprobante-deuda.png';
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (_) {}
    this.compartiendo = false;
  }

  private generarImagen(boleta: IBoleta): Promise<Blob> {
    return new Promise(resolve => {
      const W = 640;
      const PAD = 32;
      const items = boleta.items ?? [];
      const H = 90 + 30 + (boleta.direccion ? 26 : 0) + 20 + 40 + items.length * 28 + 20 + 60 + 40;

      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d')!;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, W, H);

      // Header azul
      ctx.fillStyle = '#042C53';
      ctx.fillRect(0, 0, W, 80);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 22px Arial, sans-serif';
      ctx.fillText('Hielo Fres-Cor', PAD, 34);
      ctx.font = '13px Arial, sans-serif';
      ctx.fillStyle = '#85B7EB';
      ctx.fillText('Comprobante de deuda pendiente', PAD, 56);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#85B7EB';
      ctx.font = '12px Arial, sans-serif';
      ctx.fillText(new Date(boleta.fechaBoleta).toLocaleDateString('es-AR'), W - PAD, 46);
      ctx.textAlign = 'left';

      let y = 105;

      const addRow = (label: string, value: string) => {
        ctx.fillStyle = '#5F5E5A';
        ctx.font = '12px Arial, sans-serif';
        ctx.fillText(label, PAD, y);
        ctx.fillStyle = '#2C2C2A';
        ctx.font = 'bold 13px Arial, sans-serif';
        ctx.fillText(value, PAD + 90, y);
        y += 26;
      };

      addRow('Teléfono:', boleta.telefono);
      if (boleta.direccion) addRow('Dirección:', boleta.direccion);

      y += 8;
      ctx.strokeStyle = '#E8E6DF';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();
      y += 16;

      // Header tabla
      ctx.fillStyle = '#F1EFE8';
      ctx.fillRect(PAD, y - 6, W - PAD * 2, 28);
      ctx.fillStyle = '#444441';
      ctx.font = 'bold 11px Arial, sans-serif';
      ctx.fillText('PRODUCTO', PAD + 8, y + 10);
      ctx.textAlign = 'right';
      ctx.fillText('CANTIDAD', W - PAD - 8, y + 10);
      ctx.textAlign = 'left';
      y += 32;

      items.forEach((item, i) => {
        if (i % 2 === 0) {
          ctx.fillStyle = '#FAFAF7';
          ctx.fillRect(PAD, y - 14, W - PAD * 2, 26);
        }
        ctx.fillStyle = '#2C2C2A';
        ctx.font = '13px Arial, sans-serif';
        ctx.fillText(item.tipoBolsa, PAD + 8, y);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#042C53';
        ctx.font = 'bold 13px Arial, sans-serif';
        ctx.fillText(`x${item.cantidad}`, W - PAD - 8, y);
        ctx.textAlign = 'left';
        y += 28;
      });

      y += 12;
      ctx.strokeStyle = '#E8E6DF';
      ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();
      y += 16;

      // Caja total
      ctx.fillStyle = '#1D9E75';
      ctx.beginPath();
      ctx.roundRect(PAD, y, W - PAD * 2, 44, 8);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 15px Arial, sans-serif';
      ctx.fillText('TOTAL A PAGAR', PAD + 16, y + 28);
      ctx.textAlign = 'right';
      ctx.font = 'bold 20px Arial, sans-serif';
      const total = boleta.importeConDescuento ?? boleta.importeTotal;
      ctx.fillText(`$${total.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`, W - PAD - 16, y + 29);
      ctx.textAlign = 'left';
      y += 60;

      ctx.fillStyle = '#B4B2A9';
      ctx.font = '11px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Hielo Fres-Cor — Córdoba, Argentina', W / 2, y);

      canvas.toBlob(blob => resolve(blob!), 'image/png');
    });
  }
}
