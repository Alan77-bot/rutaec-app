export type EstadoPago =
  | "PENDIENTE"
  | "EN_REVISION"
  | "CORRECCION"
  | "APROBADO"
  | "RECHAZADO"
  | "FALLIDO"
  | "RECIBIDO_INCIDENCIA";

export type MetodoPago = "DEPOSITO" | "TRANSFERENCIA";

export interface Pago {
  id: string;
  compra_id: string;
  cooperativa_id: string;
  metodo: string;
  estado: EstadoPago;
  importe: string;
  moneda: string;
  cuenta_bancaria_id: string | null;
  creado_en: string;
  aprobado_en: string | null;
}

export interface NuevoPago {
  compra_id: string;
  metodo: MetodoPago;
  cuenta_bancaria_id: string;
  clave_idempotencia: string;
}

export class ErrorPagos extends Error {
  public estado: number;

  constructor(mensaje: string, estado: number) {
    super(mensaje);
    this.name = "ErrorPagos";
    this.estado = estado;
  }
}

async function solicitar<T>(
  ruta: string,
  metodo: "GET" | "POST" = "GET",
  cuerpo?: unknown
): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`/api/pagos${ruta}`, {
      method: metodo,
      credentials: "include",
      headers: cuerpo ? { "Content-Type": "application/json" } : undefined,
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new ErrorPagos("No se pudo conectar con el servidor.", 0);
  }

  const datos = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    throw new ErrorPagos(
      datos?.error ?? "No se pudo completar la solicitud.",
      respuesta.status
    );
  }

  return datos as T;
}

export const pagosService = {
  listar() {
    return solicitar<{ total: number; datos: Pago[] }>("/");
  },

  listarPendientes() {
    return solicitar<{ total: number; datos: Pago[] }>("/pendientes");
  },

  registrar(pago: NuevoPago) {
    return solicitar<{ datos: Pago }>("/", "POST", pago);
  },
};
