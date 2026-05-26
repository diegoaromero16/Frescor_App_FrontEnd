import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminLayoutComponent } from '../../layout/admin-layout/admin-layout';
import { BoletaService } from '../../core/services/boleta.service/boleta.service';
import { IBoleta, IDeudor } from '../../core/model/boleta/i-boleta';
import { PriceService } from '../../core/services/price.service/price.service';
import { IPrecio } from '../../core/model/precio/i-precio';
import { AuthService } from '../../core/services/auth.service/auth';
import { TelefonoDireccionService } from '../../core/services/telefono-direccion.service/telefono-direccion.service';
import { iTelefonoDireccion } from '../../core/model/telefonoDireccion/i-telefono-direccion';

interface BolsaConfig {
  tipo: string;
  label: string;
  divisor: number;
}

@Component({
  selector: 'app-deudas',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminLayoutComponent],
  templateUrl: './deudas.html',
  styleUrls: ['./deudas.css']
})
export class DeudasComponent implements OnInit {

  readonly BOLSAS: BolsaConfig[] = [
    { tipo: '1,5kg',     label: 'Bolsa 1,5kg',   divisor: 10 },
    { tipo: '2,5kg',     label: 'Bolsa 2,5kg',    divisor: 7  },
    { tipo: '4,5kg',     label: 'Bolsa 4,5kg',    divisor: 4  },
    { tipo: '10kg',      label: 'Bolsa 10,5kg',   divisor: 1  },
    { tipo: 'Triturado', label: 'Triturado 10kg', divisor: 1  },
  ];

  // Rol
  get esAdmin(): boolean { return this.authService.isAdmin(); }

  // Vista admin
  vistaActual: 'deudores' | 'cliente' = 'deudores';
  deudores: IDeudor[] = [];
  cargandoDeudores = false;
  telefonoBusqueda = '';
  telefonoActual = '';
  boletas: IBoleta[] = [];
  cargandoBoletas = false;

  // Precios
  precios: IPrecio[] = [];

  // Formulario (compartido admin-modal y repartidor-página)
  modalAbierto = false;
  guardando = false;
  mensajeExito = '';
  mensajeError = '';
  formTelefono = '';
  formFecha = '';
  cantidades: Record<string, number> = {};

  // Búsqueda de dirección
  direcciones: iTelefonoDireccion[] = [];
  direccionSeleccionada: iTelefonoDireccion | null = null;
  buscandoDirecciones = false;
  errorDireccion = '';

  // Comprobante
  boletaGuardada: IBoleta | null = null;
  modalComprobanteAbierto = false;
  comprobanteImgUrl: string | null = null;
  compartiendo = false;

  // Pago
  modalPagoAbierto = false;
  boletaAPagar: IBoleta | null = null;
  marcandoPagada = false;

  // Eliminar
  modalEliminarAbierto = false;
  boletaAEliminar: IBoleta | null = null;
  eliminando = false;

  constructor(
    private boletaService: BoletaService,
    private priceService: PriceService,
    public authService: AuthService,
    private telefonoDireccionService: TelefonoDireccionService
  ) { }

  ngOnInit(): void {
    this.priceService.obtenerPrecios().subscribe({
      next: (res) => { if (res.success) this.precios = res.data; }
    });
    if (this.esAdmin) {
      this.cargarDeudores();
    } else {
      this.resetForm();
    }
  }

  // ── Precios ──────────────────────────────────────────────────────────────
  getPrecioUnitario(tipo: string): number {
    const precio = this.precios.find(p => p.tipoBolsa === tipo);
    if (!precio) return 0;
    const bolsa = this.BOLSAS.find(b => b.tipo === tipo);
    return precio.precio1 / (bolsa?.divisor ?? 1);
  }

  getSubtotal(tipo: string): number {
    return (this.cantidades[tipo] ?? 0) * this.getPrecioUnitario(tipo);
  }

  getTotal(): number {
    return this.BOLSAS.reduce((acc, b) => acc + this.getSubtotal(b.tipo), 0);
  }

  // ── Vista admin ───────────────────────────────────────────────────────────
  cargarDeudores(): void {
    this.cargandoDeudores = true;
    this.boletaService.getDeudores().subscribe({
      next: (res) => { this.cargandoDeudores = false; if (res.success) this.deudores = res.data; },
      error: () => this.cargandoDeudores = false
    });
  }

  buscarCliente(): void {
    const tel = this.telefonoBusqueda.trim();
    if (!tel) return;
    this.telefonoActual = tel;
    this.vistaActual = 'cliente';
    this.cargarBoletas();
  }

  verCliente(telefono: string): void {
    this.telefonoBusqueda = telefono;
    this.telefonoActual = telefono;
    this.vistaActual = 'cliente';
    this.cargarBoletas();
  }

  cargarBoletas(): void {
    this.cargandoBoletas = true;
    this.boletaService.getByTelefono(this.telefonoActual).subscribe({
      next: (res) => { this.cargandoBoletas = false; if (res.success) this.boletas = res.data; },
      error: () => this.cargandoBoletas = false
    });
  }

  volverADeudores(): void {
    this.vistaActual = 'deudores';
    this.boletas = [];
    this.telefonoActual = '';
    this.cargarDeudores();
  }

  // ── Formulario boleta ─────────────────────────────────────────────────────
  resetForm(telefono = ''): void {
    this.formTelefono = telefono;
    this.formFecha = new Date().toISOString().split('T')[0];
    this.cantidades = {};
    this.mensajeError = '';
    this.direcciones = [];
    this.direccionSeleccionada = null;
    this.errorDireccion = '';
    if (telefono) this.buscarDirecciones();
  }

  abrirNuevaBoleta(telefono?: string): void {
    this.resetForm(telefono ?? this.telefonoActual);
    this.modalAbierto = true;
  }

  cerrarModal(): void {
    this.modalAbierto = false;
  }

  buscarDirecciones(): void {
    const tel = this.formTelefono.trim();
    if (!tel) return;
    this.buscandoDirecciones = true;
    this.errorDireccion = '';
    this.direcciones = [];
    this.direccionSeleccionada = null;
    this.telefonoDireccionService.obtenerDirecciones(tel).subscribe({
      next: (res) => {
        this.buscandoDirecciones = false;
        if (res.success && res.data?.length > 0) {
          this.direcciones = res.data;
          if (res.data.length === 1) this.direccionSeleccionada = res.data[0];
        } else {
          this.errorDireccion = 'No se encontraron direcciones para ese teléfono.';
        }
      },
      error: () => {
        this.buscandoDirecciones = false;
        this.errorDireccion = 'Error al buscar el cliente.';
      }
    });
  }

  guardarBoleta(): void {
    if (!this.formTelefono.trim()) {
      this.mensajeError = 'El teléfono es requerido.';
      return;
    }
    if (!this.direccionSeleccionada) {
      this.mensajeError = 'Seleccioná una dirección.';
      return;
    }
    const items = this.buildItems();
    if (items.length === 0) {
      this.mensajeError = 'Seleccioná al menos un producto.';
      return;
    }

    const total = this.getTotal();
    const boleta: IBoleta = {
      telefono: this.formTelefono.trim(),
      direccion: this.direccionSeleccionada.direccion,
      fechaBoleta: this.formFecha,
      importeTotal: total,
      estado: 'Pendiente',
      items
    };

    this.guardando = true;
    this.mensajeError = '';
    this.boletaService.crear(boleta).subscribe({
      next: (res) => {
        this.guardando = false;
        if (res.success) {
          this.modalAbierto = false;
          if (this.esAdmin) {
            if (this.vistaActual === 'cliente') this.cargarBoletas();
            this.cargarDeudores();
          }
          this.abrirComprobante(res.data);
          this.resetForm();
        } else {
          this.mensajeError = res.message || 'Error al guardar.';
        }
      },
      error: () => { this.guardando = false; this.mensajeError = 'Error al guardar la boleta.'; }
    });
  }

  private buildItems() {
    return this.BOLSAS
      .filter(b => (this.cantidades[b.tipo] ?? 0) > 0)
      .map(b => ({
        tipoBolsa: b.tipo,
        cantidad: this.cantidades[b.tipo],
        precioUnitario: this.getPrecioUnitario(b.tipo),
        subtotal: this.getSubtotal(b.tipo)
      }));
  }

  // ── Comprobante ───────────────────────────────────────────────────────────
  abrirComprobante(boleta: IBoleta): void {
    this.boletaGuardada = boleta;
    this.generarImagenComprobante(boleta).then(blob => {
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
  }

  async compartirWhatsApp(): Promise<void> {
    if (!this.boletaGuardada) return;
    this.compartiendo = true;
    try {
      const blob = await this.generarImagenComprobante(this.boletaGuardada);
      const file = new File([blob], 'comprobante-deuda.png', { type: 'image/png' });
      const nav = navigator as any;
      if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: 'Comprobante de deuda - Hielo Fres-Cor' });
      } else {
        // Fallback desktop: descargar imagen
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'comprobante-deuda.png';
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (_) { /* usuario canceló */ }
    this.compartiendo = false;
  }

  private generarImagenComprobante(boleta: IBoleta): Promise<Blob> {
    return new Promise(resolve => {
      const W = 640;
      const PAD = 32;
      const items = boleta.items ?? [];
      const H = 90 + 30 + (boleta.direccion ? 26 : 0) + 20 + 40 + items.length * 28 + 20 + 60 + 40;

      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d')!;

      // Fondo blanco
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

      // Fecha top-right
      ctx.textAlign = 'right';
      ctx.fillStyle = '#85B7EB';
      ctx.font = '12px Arial, sans-serif';
      ctx.fillText(new Date(boleta.fechaBoleta).toLocaleDateString('es-AR'), W - PAD, 46);
      ctx.textAlign = 'left';

      let y = 105;

      // Datos cliente
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

      // Separador
      ctx.strokeStyle = '#E8E6DF';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();
      y += 16;

      // Header tabla productos
      ctx.fillStyle = '#F1EFE8';
      ctx.fillRect(PAD, y - 6, W - PAD * 2, 28);
      ctx.fillStyle = '#444441';
      ctx.font = 'bold 11px Arial, sans-serif';
      ctx.fillText('PRODUCTO', PAD + 8, y + 10);
      ctx.textAlign = 'center';
      ctx.fillText('CANT.', W - PAD - 130, y + 10);
      ctx.textAlign = 'right';
      ctx.fillText('SUBTOTAL', W - PAD - 8, y + 10);
      ctx.textAlign = 'left';
      y += 32;

      // Filas productos
      items.forEach((item, i) => {
        if (i % 2 === 0) {
          ctx.fillStyle = '#FAFAF7';
          ctx.fillRect(PAD, y - 14, W - PAD * 2, 26);
        }
        ctx.fillStyle = '#2C2C2A';
        ctx.font = '13px Arial, sans-serif';
        ctx.fillText(item.tipoBolsa, PAD + 8, y);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#5F5E5A';
        ctx.fillText(String(item.cantidad), W - PAD - 130, y);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#042C53';
        ctx.font = 'bold 13px Arial, sans-serif';
        ctx.fillText(`$${item.subtotal.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`, W - PAD - 8, y);
        ctx.textAlign = 'left';
        y += 28;
      });

      y += 12;

      // Separador
      ctx.strokeStyle = '#E8E6DF';
      ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();
      y += 16;

      // Caja total verde
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

      // Footer
      ctx.fillStyle = '#B4B2A9';
      ctx.font = '11px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Hielo Fres-Cor — Córdoba, Argentina', W / 2, y);

      canvas.toBlob(blob => resolve(blob!), 'image/png');
    });
  }

  // ── Eliminar boleta ───────────────────────────────────────────────────────
  confirmarEliminar(boleta: IBoleta): void { this.boletaAEliminar = boleta; this.modalEliminarAbierto = true; }
  cancelarEliminar(): void { this.modalEliminarAbierto = false; this.boletaAEliminar = null; }

  eliminarBoleta(): void {
    if (!this.boletaAEliminar?.id) return;
    this.eliminando = true;
    this.boletaService.eliminar(this.boletaAEliminar.id).subscribe({
      next: (res) => {
        this.eliminando = false;
        if (res.success) {
          this.modalEliminarAbierto = false;
          this.boletaAEliminar = null;
          this.mensajeExito = 'Boleta eliminada.';
          setTimeout(() => this.mensajeExito = '', 3000);
          this.cargarBoletas();
          this.cargarDeudores();
        }
      },
      error: () => { this.eliminando = false; }
    });
  }

  // ── Marcar pagada ─────────────────────────────────────────────────────────
  confirmarPago(boleta: IBoleta): void { this.boletaAPagar = boleta; this.modalPagoAbierto = true; }
  cancelarPago(): void { this.modalPagoAbierto = false; this.boletaAPagar = null; }

  marcarPagada(): void {
    if (!this.boletaAPagar?.id) return;
    this.marcandoPagada = true;
    this.boletaService.marcarPagada(this.boletaAPagar.id).subscribe({
      next: (res) => {
        this.marcandoPagada = false;
        if (res.success) {
          this.modalPagoAbierto = false;
          this.boletaAPagar = null;
          this.mensajeExito = 'Boleta marcada como pagada.';
          setTimeout(() => this.mensajeExito = '', 3000);
          this.cargarBoletas();
          this.cargarDeudores();
        }
      },
      error: () => this.marcandoPagada = false
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  totalPendiente(): number {
    return this.boletas
      .filter(b => b.estado === 'Pendiente')
      .reduce((acc, b) => acc + (b.importeConDescuento ?? b.importeTotal), 0);
  }

  diasDesde(fecha: string): number {
    return Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000);
  }

  formatFecha(fecha: string): string {
    if (!fecha) return '-';
    return new Date(fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  colorDeudor(deudor: IDeudor): string {
    const dias = this.diasDesde(deudor.fechaMasAntigua);
    if (deudor.cantidadBoletas >= 2 || dias >= 7) return 'fila-roja';
    return 'fila-naranja';
  }
}
