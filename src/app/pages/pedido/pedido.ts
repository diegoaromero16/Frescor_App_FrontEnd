import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { iTelefonoDireccion } from '../../core/model/telefonoDireccion/i-telefono-direccion';
import { IPrecio } from '../../core/model/precio/i-precio';
import { CurrencyPipe, DatePipe, NgIf } from '@angular/common';
import { IPedido } from '../../core/model/pedido/i-pedido';
import { TelefonoDireccionService } from '../../core/services/telefono-direccion.service/telefono-direccion.service';
import { PriceService } from '../../core/services/price.service/price.service';
import { PaymentService } from '../../core/services/payment.service/payment.service';
import { PedidoService } from '../../core/services/pedido.service/pedido.service';


@Component({
  selector: 'app-pedido',
  imports: [FormsModule, CurrencyPipe, DatePipe],
  standalone: true,
  templateUrl: './pedido.html',
  styleUrl: './pedido.css',
})
export class Pedido implements OnInit {
  currentStep = signal(1);

  telefono = '';
  direccionSeleccionada: iTelefonoDireccion | null = null;
  errorProductos = '';
  totalPedido = 0;

  medioPago = '';
  errorMedioPago = '';
  procesandoPago = false;
  isProcessingPayment = false;

  direcciones: iTelefonoDireccion[] = [];
  precios: IPrecio[] = [];

  opciones10kg = this.generarRango(1, 50);
  opciones25kg = this.generarRango(7, 200, 7);
  opciones15kg = this.generarRango(10, 200, 10);
  opcionesTriturado = this.generarRango(1, 50);
  opciones45kg = this.generarRango(0, 48, 4);

  cantidades = {
    bolsa15: null,
    bolsa25: null,
    bolsa45: null,
    bolsa10: null,
    triturado10: null
  };

  // Descuento
  cuponDescuento = 0;
  porcentajeDescuento = 0;
  totalSinDescuento = 0;
  totalConDescuento = 0;
  tieneDescuento = false;
  descuentoEfectivo = 0;
  totalConDescuentoEfectivo = 0;
  tieneDescuentoEfectivo = false;

  pedidoConfirmado: any = null;

  private poTelefonoDireccionService = inject(TelefonoDireccionService);
  private priceService = inject(PriceService);
  private paymentService = inject(PaymentService);
  private pedidoService = inject(PedidoService);

  ngOnInit() {
    this.getPrices();
    this.getDescuentoEfectivo();
  }

  nextStep() {
    if (this.currentStep() === 2 && this.direccionSeleccionada) {
      this.cuponDescuento = this.direccionSeleccionada.cuponDescuento ?? 0;
      this.aplicarDescuentoCliente();
    }

    if (this.currentStep() === 3 && !this.haveProducts()) {
      this.errorProductos = 'Debés seleccionar al menos un producto.';
      return;
    }

    this.errorProductos = '';
    this.currentStep.update(step => step + 1);
  }
  prevStep() {
    this.currentStep.update(step => step - 1);
  }
  goToStep(step: number) {
    this.currentStep.set(step);
  }
  continuarTelefono() {
    if (!this.telefono) return;

    this.poTelefonoDireccionService
      .obtenerDirecciones(this.telefono)
      .subscribe({
        next: (response) => {
          this.direcciones = response.data;

          if (this.direcciones.length > 0) {
            this.nextStep();
          }
        },
        error: (err) => {
          console.error('Error al obtener direcciones', err);
        }
      });
  }
  private generarRango(inicio: number, fin: number, salto: number = 1): number[] {
    const resultado: number[] = [];

    for (let i = inicio; i <= fin; i += salto) {
      resultado.push(i);
    }

    return resultado;
  }
  getPrices() {
    this.priceService.obtenerPrecios().subscribe({
      next: (response) => {
        this.precios = response.data;
      },
      error: (err) => {
        console.error('Error al obtener precios', err);
      }
    });
  }
  getPriceByBadge(tipoBolsa: string): number {
    return this.precios.find(x => x.tipoBolsa === tipoBolsa)?.precio1 ?? 0;
  }
  getTotal() {
    const total15 = (this.cantidades.bolsa15 ?? 0) * (this.getPriceByBadge('1,5kg') / 10);
    const total25 = (this.cantidades.bolsa25 ?? 0) * (this.getPriceByBadge('2,5kg') / 7);
    const total45 = (this.cantidades.bolsa45 ?? 0) * (this.getPriceByBadge('4,5kg') / 4);
    const total10 = (this.cantidades.bolsa10 ?? 0) * this.getPriceByBadge('10kg');
    const totalTriturado = (this.cantidades.triturado10 ?? 0) * this.getPriceByBadge('Triturado');

    this.totalSinDescuento = total15 + total25 + total45 + total10 + totalTriturado;
    this.aplicarDescuentoCliente();
  }
  haveProducts(): boolean {
    return (
      (this.cantidades.bolsa15 ?? 0) > 0 ||
      (this.cantidades.bolsa25 ?? 0) > 0 ||
      (this.cantidades.bolsa45 ?? 0) > 0 ||
      (this.cantidades.bolsa10 ?? 0) > 0 ||
      (this.cantidades.triturado10 ?? 0) > 0
    );
  }
  seleccionarMedioPago(tipo: string) {
    this.medioPago = tipo;
    this.errorMedioPago = '';

    if (tipo === 'efectivo') {
      this.tieneDescuentoEfectivo = true;
      const baseParaDescuento = this.tieneDescuento ? this.totalConDescuento : this.totalSinDescuento;
      this.totalConDescuentoEfectivo = baseParaDescuento - (baseParaDescuento * this.descuentoEfectivo / 100);
      this.totalPedido = this.totalConDescuentoEfectivo;
    } else {
      this.tieneDescuentoEfectivo = false;
      this.totalPedido = this.tieneDescuento ? this.totalConDescuento : this.totalSinDescuento;
    }
  }
  continuarPago() {
    if (!this.medioPago) {
      this.errorMedioPago = 'Seleccioná un medio de pago.';
      return;
    }

    this.errorMedioPago = '';
    this.isProcessingPayment = true;

    const order: IPedido = this.createOrder();

    //guardamos el pedido antes de redirigir a MercadoPago para tener el ID del pedido y asociarlo al paymentId que devuelve MercadoPago
    this.pedidoService.insertarPedido(order).subscribe({
      next: (response) => {
        if (!response.success || !response.data) {
          this.errorMedioPago = 'No se pudo guardar el pedido.';
          this.isProcessingPayment = false;
          return;
        }

        const pedidoGuardado = response.data;
        this.pedidoConfirmado = pedidoGuardado;

        if (this.medioPago === 'mercadopago') {
          if (!pedidoGuardado.id) {
            this.errorMedioPago = 'No se obtuvo el ID del pedido.';
            this.isProcessingPayment = false;
            return;
          }
          localStorage.setItem('lastOrderId', pedidoGuardado.id.toString());
          this.createMPReference(pedidoGuardado.id);
          return;
        }

        // efectivo
        this.isProcessingPayment = false;
        this.currentStep.set(5);
      },
      error: (err) => {
        console.error('Error guardando pedido', err);
        this.errorMedioPago = 'No se pudo guardar el pedido.';
        this.isProcessingPayment = false;
      }
    });
  }
  getTextoBotonStep(): string {
    if (this.currentStep() === 4) {
      if (this.medioPago === 'mercadopago') {
        return 'Pagar';
      }

      if (this.medioPago === 'efectivo') {
        return 'Cargar pedido';
      }

      return 'Continuar';
    }

    return 'Continuar';
  }
  createMPReference(orderId: number) {

    this.paymentService
      .crearPreferencia(this.totalPedido, orderId)
      .subscribe({
        next: (response) => {
          if (response.success) {
            window.location.href = response.data;
          } else {
            this.errorMedioPago = 'No se pudo iniciar Mercado Pago.';
            this.isProcessingPayment = false;
          }
        },
        error: (err) => {
          console.error(err);
          this.errorMedioPago = err?.error?.message || 'Error al conectar con Mercado Pago.';
          this.isProcessingPayment = false;
        }
      });
  }
  createOrder(): IPedido {
    return {
      telefono: this.telefono,
      direccion: this.direccionSeleccionada?.direccion || '',
      kg10_5: this.cantidades.bolsa10 ?? 0,
      kg2_5: this.cantidades.bolsa25 ?? 0,
      kg1_5: this.cantidades.bolsa15 ?? 0,
      triturado: this.cantidades.triturado10 ?? 0,
      kg4_5: this.cantidades.bolsa45 ?? 0,
      fecha_Carga: new Date(new Date().getTime() - (3 * 60 * 60 * 1000)).toISOString(),
      precio_Total: this.totalPedido.toFixed(2),
      zona: this.direccionSeleccionada?.zona ?? 0,
      formaPago: this.medioPago,
      paymentId: null,
      estado: this.medioPago === 'efectivo' ? 'PendientePago' : 'PendientePago'
    };
  }
  aplicarDescuentoCliente() {
    if (this.cuponDescuento > 0 && this.porcentajeDescuento === 0) {
      // Buscar porcentaje del cupón
      this.priceService.obtenerCupon(this.cuponDescuento).subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.porcentajeDescuento = response.data.porcentaje;
            this.calcularTotales();
          }
        },
        error: () => {
          this.calcularTotales();
        }
      });
    } else {
      this.calcularTotales();
    }
  }
  calcularTotales() {
    if (this.porcentajeDescuento > 0 && this.totalSinDescuento > 0) {
      this.tieneDescuento = true;
      this.totalConDescuento = this.totalSinDescuento - (this.totalSinDescuento * this.porcentajeDescuento / 100);
      this.totalPedido = this.totalConDescuento;
    } else {
      this.tieneDescuento = false;
      this.totalPedido = this.totalSinDescuento;
    }
  }
  getDescuentoEfectivo() {
    this.priceService.obtenerCupon(20).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.descuentoEfectivo = response.data.porcentaje;
        }
      },
      error: (err) => {
        console.error('Error al obtener descuento efectivo', err);
      }
    });
  }
  descargarComprobante(): void {
    import('jspdf').then(({ jsPDF }) => {
      const p = this.pedidoConfirmado;
      const fecha = new Date(p.fecha_Carga).toLocaleDateString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });

      const doc = new jsPDF();

      // Cargar logo como base64
      const img = new Image();
      img.src = 'logo-frescor.jpeg';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        const base64 = canvas.toDataURL('image/jpeg');

        // Header
        doc.setFillColor(4, 44, 83);
        doc.rect(0, 0, 210, 45, 'F');

        // Logo centrado
        doc.addImage(base64, 'JPEG', 88, 5, 35, 35);

        // Línea separadora
        doc.setDrawColor(211, 209, 199);
        doc.line(15, 50, 195, 50);

        // Número de orden
        doc.setTextColor(4, 44, 83);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(`Pedido #${p.id}`, 105, 62, { align: 'center' });

        doc.setDrawColor(211, 209, 199);
        doc.line(15, 67, 195, 67);

        // Datos generales
        let y = 77;
        doc.setFontSize(10);

        const addRow = (label: string, value: string) => {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(68, 68, 65);
          doc.text(label, 15, y);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(44, 44, 42);
          doc.text(value, 80, y);
          y += 8;
        };

        addRow('Fecha:', fecha);
        addRow('Dirección:', this.direccionSeleccionada?.direccionMayusculas || '');
        addRow('Zona:', `${p.zona}`);
        addRow('Forma de pago:', p.formaPago === 'mercadopago' ? 'Mercado Pago' : 'Efectivo');
        if (p.paymentId) addRow('Payment ID:', p.paymentId);
        addRow('Estado:', p.estado === 'Pagado' ? 'Pagado' : 'Pendiente de pago');

        y += 5;
        doc.line(15, y, 195, y);
        y += 10;

        // Productos
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(4, 44, 83);
        doc.setFontSize(12);
        doc.text('Productos', 15, y);
        y += 8;

        doc.setFontSize(10);
        doc.setTextColor(44, 44, 42);

        if (p.kg1_5 > 0) { doc.text(`Bolsas 1,5kg`, 20, y); doc.text(`${p.kg1_5} unidades`, 150, y); y += 7; }
        if (p.kg2_5 > 0) { doc.text(`Bolsas 2,5kg`, 20, y); doc.text(`${p.kg2_5} unidades`, 150, y); y += 7; }
        if (p.kg4_5 > 0) { doc.text(`Bolsas 4,5kg`, 20, y); doc.text(`${p.kg4_5} unidades`, 150, y); y += 7; }
        if (p.kg10_5 > 0) { doc.text(`Bolsas 10kg`, 20, y); doc.text(`${p.kg10_5} unidades`, 150, y); y += 7; }
        if (p.triturado > 0) { doc.text(`Triturado 10kg`, 20, y); doc.text(`${p.triturado} unidades`, 150, y); y += 7; }

        y += 5;
        doc.line(15, y, 195, y);
        y += 10;

        // Total
        doc.setFillColor(29, 158, 117);
        doc.rect(15, y - 3, 180, 14, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.text('TOTAL:', 20, y + 7);
        doc.text(`$${parseFloat(p.precio_Total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, 185, y + 7, { align: 'right' });

        y += 25;

        // Footer
        doc.setFontSize(9);
        doc.setTextColor(95, 94, 90);
        doc.setFont('helvetica', 'normal');
        doc.text('Gracias por su pedido. Hielo Fres-Cor - Córdoba, Argentina', 105, y, { align: 'center' });

        doc.save(`comprobante-pedido-${p.id}.pdf`);
      };
    });
  } nuevosPedido(): void {
    this.currentStep.set(1);
    this.telefono = '';
    this.direccionSeleccionada = null;
    this.direcciones = [];
    this.cantidades = {
      bolsa15: null,
      bolsa25: null,
      bolsa45: null,
      bolsa10: null,
      triturado10: null
    };
    this.medioPago = '';
    this.totalPedido = 0;
    this.totalSinDescuento = 0;
    this.totalConDescuento = 0;
    this.totalConDescuentoEfectivo = 0;
    this.tieneDescuento = false;
    this.tieneDescuentoEfectivo = false;
    this.porcentajeDescuento = 0;
    this.cuponDescuento = 0;
    this.pedidoConfirmado = null;
  }
}
