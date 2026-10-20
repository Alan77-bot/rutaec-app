export interface DatosBoleto {
  cooperativa: string;
  pasajero: { nombres?: string; apellidos?: string };
  asiento: { numero?: string; piso?: number; categoria?: string };
  origen: string;
  destino: string;
  salida: string;
  llegada: string;
  placa?: string | null;
  unidad?: string | null;
  precio_base: number | string;
  descuento: number | string;
  importe: number | string;
  moneda: string;
}

export interface Boleto {
  id: string;
  codigo: string;
  estado: "EMITIDO" | "ANULADO";
  emitidoEn: string;
  compraId: string;
  qr?: string;
  datos: DatosBoleto;
}

export class ErrorBoletos extends Error {
  public estado: number;

  constructor(mensaje: string, estado: number) {
    super(mensaje);
    this.name = "ErrorBoletos";
    this.estado = estado;
  }
}

export type ResultadoVerificacion =
  | "VALIDO"
  | "ANULADO"
  | "YA_ABORDADO"
  | "VIAJE_INCORRECTO"
  | "VIAJE_CANCELADO"
  | "FUERA_DE_HORARIO"
  | "NO_ENCONTRADO";

export interface RespuestaVerificacion {
  resultado: ResultadoVerificacion;
  mensaje: string;
  boleto?: {
    id: string;
    codigo: string;
    pasajero: string;
    asiento: string | null;
    origen: string;
    destino: string;
    salida: string;
    viajeId: string;
  };
}

async function solicitar<T>(ruta: string, cuerpo?: unknown): Promise<T> {
  let respuesta: Response;

  try {
    respuesta = await fetch(`/api/boletos${ruta}`, {
      method: cuerpo === undefined ? "GET" : "POST",
      credentials: "include",
      headers: cuerpo === undefined ? undefined : { "Content-Type": "application/json" },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    throw new ErrorBoletos(
      "No se pudo conectar con la API. Comprueba que el backend esté encendido.",
      0
    );
  }

  const datos = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    throw new ErrorBoletos(
      datos?.error ?? "No se pudo completar la solicitud.",
      respuesta.status
    );
  }

  return datos as T;
}

export const boletosService = {
  async mios(): Promise<Boleto[]> {
    const respuesta = await solicitar<{ datos: Boleto[] }>("/mios");
    return respuesta.datos;
  },

  async obtener(id: string): Promise<Boleto> {
    const respuesta = await solicitar<{ datos: Boleto }>(`/${encodeURIComponent(id)}`);
    return respuesta.datos;
  },

  // Lo usa el personal de la cooperativa al escanear un QR (abordaje).
  async verificar(codigo: string, viajeId?: string): Promise<RespuestaVerificacion> {
    const respuesta = await solicitar<{ datos: RespuestaVerificacion }>("/verificar", {
      codigo,
      ...(viajeId ? { viajeId } : {}),
    });
    return respuesta.datos;
  },

  // El PDF se descarga con la cookie de sesión: basta un enlace normal.
  urlPdf(id: string): string {
    return `/api/boletos/${encodeURIComponent(id)}/pdf`;
  },
};
