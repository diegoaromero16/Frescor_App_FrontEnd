import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {

  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  getMetricas(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/orders/metricas`);
  }

  filtrarPedidos(filtros: {
    desde?: string;
    hasta?: string;
    direccion?: string;
    zona?: number;
    formaPago?: string;
    estado?: string;
    pagina?: number;
    tamañoPagina?: number;
  }): Observable<any> {
    let params = new URLSearchParams();

    if (filtros.desde) params.append('desde', filtros.desde);
    if (filtros.hasta) params.append('hasta', filtros.hasta);
    if (filtros.direccion) params.append('direccion', filtros.direccion);
    if (filtros.zona) params.append('zona', filtros.zona.toString());
    if (filtros.formaPago) params.append('formaPago', filtros.formaPago);
    if (filtros.estado) params.append('estado', filtros.estado);
    params.append('pagina', (filtros.pagina || 1).toString());
    params.append('tamañoPagina', (filtros.tamañoPagina || 50).toString());

    return this.http.get<any>(`${this.baseUrl}/orders/filtrar?${params.toString()}`);
  }

  exportarExcel(pedidos: any[]): void {
    const headers = ['Direccion', 'Tel', 'Zona', '10,5kg', '4,5kg', '2,5kg', '1,5kg', 'Trit', 'Fecha_Carga', 'Precio_Total', 'FormaPago', 'Estado'];

    const mapFormaPago = (fp: string): string => {
      if (!fp) return '';
      const lower = fp.toLowerCase();
      if (lower === 'efectivo') return 'EFT';
      if (lower === 'mercadopago') return 'MP';
      return fp;
    };

    const mapEstado = (estado: string): string => {
      if (!estado) return '';
      if (estado === 'Pagado') return 'Pagado';
      if (estado === 'PagoRechazado') return 'Rechazado';
      return 'Pendiente';
    };

    const rows = pedidos.map(p => [
      `"${(p.direccion || '').replace(/"/g, '""')}"`,
      p.telefono || '',
      p.zona,
      p.kg10_5,
      p.kg4_5,
      p.kg2_5,
      p.kg1_5,
      p.triturado,
      p.fecha_Carga || '',
      p.precio_Total,
      mapFormaPago(p.formaPago),
      mapEstado(p.estado)
    ]);

    const csvContent = ['sep=;', headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pedidos_${new Date().toLocaleDateString('es-AR').replace(/\//g, '-')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}