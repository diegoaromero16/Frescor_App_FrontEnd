import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { IBoleta, IDeudor } from '../../model/boleta/i-boleta';
import { ApiResponse } from '../../model/ApiResponse/ApiResponse';

@Injectable({
  providedIn: 'root'
})
export class BoletaService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getByTelefono(telefono: string): Observable<ApiResponse<IBoleta[]>> {
    return this.http.get<ApiResponse<IBoleta[]>>(`${this.apiUrl}/boletas?telefono=${encodeURIComponent(telefono)}`);
  }

  crear(boleta: IBoleta): Observable<ApiResponse<IBoleta>> {
    return this.http.post<ApiResponse<IBoleta>>(`${this.apiUrl}/boletas`, boleta);
  }

  marcarPagada(id: number): Observable<ApiResponse<IBoleta>> {
    return this.http.put<ApiResponse<IBoleta>>(`${this.apiUrl}/boletas/${id}/pagar`, {});
  }

  eliminar(id: number): Observable<ApiResponse<boolean>> {
    return this.http.delete<ApiResponse<boolean>>(`${this.apiUrl}/boletas/${id}`);
  }

  getDeudores(): Observable<ApiResponse<IDeudor[]>> {
    return this.http.get<ApiResponse<IDeudor[]>>(`${this.apiUrl}/boletas/deudores`);
  }
}
