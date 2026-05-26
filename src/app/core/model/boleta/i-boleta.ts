export interface IBoletaItem {
    id?: number;
    boletaId?: number;
    tipoBolsa: string;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
}

export interface IBoleta {
    id?: number;
    pedidoId?: number;
    telefono: string;
    direccion?: string;
    fechaBoleta: string;
    importeTotal: number;
    importeConDescuento?: number;
    estado: string;
    fechaCarga?: string;
    items: IBoletaItem[];
}

export interface IDeudor {
    telefono: string;
    cantidadBoletas: number;
    totalAdeudado: number;
    fechaMasAntigua: string;
}
