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

export interface NuevoPagoConComprobante {
  compra_id: string;
  metodo: MetodoPago;
  cuenta_bancaria_id: string;
  clave_idempotencia: string;
  numero_referencia: string;
  fecha_operacion: string; // AAAA-MM-DD
  importe_declarado: string;
  archivo: File; // JPG, PNG o PDF, maximo 5 MB
}

export interface ResultadoPagoCreado {
  creado: true;
  pago_id: string;
  estado_pago: EstadoPago | null;
  estado_compra: string | null;
  revision_id: string | null;
  estado_revision: string | null;
  numero_referencia: string;
  importe_declarado: string;
  archivo: { nombre: string; tipo: string; tamano_bytes: number };
}

export interface ResultadoPagoExistente {
  creado: false;
  pago_id: string;
  estado_pago: EstadoPago;
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
  cuerpo?: BodyInit
): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`/api/pagos${ruta}`, {
      method: metodo,
      credentials: "include",
      body: cuerpo,
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

  // Un solo paso: crea el pago y recibe el comprobante (multipart).
  // El navegador fija el Content-Type con su boundary; no se debe definir aqui.
  registrarConComprobante(pago: NuevoPagoConComprobante) {
    const formulario = new FormData();
    formulario.append("compra_id", pago.compra_id);
    formulario.append("metodo", pago.metodo);
    formulario.append("cuenta_bancaria_id", pago.cuenta_bancaria_id);
    formulario.append("clave_idempotencia", pago.clave_idempotencia);
    formulario.append("numero_referencia", pago.numero_referencia);
    formulario.append("fecha_operacion", pago.fecha_operacion);
    formulario.append("importe_declarado", pago.importe_declarado);
    formulario.append("archivo", pago.archivo);
    return solicitar<{ datos: ResultadoPagoCreado | ResultadoPagoExistente }>(
      "/",
      "POST",
      formulario
    );
  },
};
