import { prisma } from "../../lib/prisma.js";

export class ErrorBoleto extends Error {
  constructor(
    public estado: number,
    mensaje: string
  ) {
    super(mensaje);
  }
}

// Datos mínimos de la sesión que usa este módulo (los entrega el login).
export type SesionBoletos = {
  id: string;
  rol: "admin" | "cooperativa" | "oficinista" | "usuario";
  coopId: string | null;
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function esUuid(valor: unknown): valor is string {
  return typeof valor === "string" && UUID.test(valor);
}

type FilaBoleto = {
  id: string;
  codigo: string;
  estado: string;
  emitido_en: Date;
  compra_id: string;
  comprador_id: string;
  cooperativa_id: string;
  qr_token: string;
  datos_emision: DatosEmision;
};

export type DatosEmision = {
  cooperativa: string;
  color_primario?: string | null;
  color_secundario?: string | null;
  pasajero: { nombres?: string; apellidos?: string; [clave: string]: unknown };
  asiento: { numero?: string; piso?: number; categoria?: string; [clave: string]: unknown };
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
};

const COLUMNAS = `
  b.id::text            AS id,
  b.codigo::text        AS codigo,
  b.estado              AS estado,
  b.emitido_en          AS emitido_en,
  b.compra_id::text     AS compra_id,
  c.comprador_id::text  AS comprador_id,
  c.cooperativa_id::text AS cooperativa_id,
  b.qr_token::text      AS qr_token,
  b.datos_emision       AS datos_emision
`;

// Lo que ve el cliente en pantalla: nunca incluye el token del QR de otros.
function paraCliente(fila: FilaBoleto, incluirQr: boolean) {
  return {
    id: fila.id,
    codigo: fila.codigo,
    estado: fila.estado,
    emitidoEn: fila.emitido_en,
    compraId: fila.compra_id,
    qr: incluirQr ? fila.qr_token : undefined,
    datos: fila.datos_emision,
  };
}

export async function listarBoletosDelUsuario(usuarioId: string) {
  const filas = await prisma.$queryRawUnsafe<FilaBoleto[]>(
    `SELECT ${COLUMNAS}
       FROM rutaec.boletos b
       JOIN rutaec.compras c ON c.id = b.compra_id
      WHERE c.comprador_id = $1::uuid
      ORDER BY b.emitido_en DESC`,
    usuarioId
  );

  return filas.map((fila) => paraCliente(fila, true));
}

export async function buscarBoletoConPermiso(
  boletoId: string,
  sesion: SesionBoletos
): Promise<FilaBoleto> {
  if (!esUuid(boletoId)) {
    throw new ErrorBoleto(400, "El identificador del boleto no es válido.");
  }

  const filas = await prisma.$queryRawUnsafe<FilaBoleto[]>(
    `SELECT ${COLUMNAS}
       FROM rutaec.boletos b
       JOIN rutaec.compras c ON c.id = b.compra_id
      WHERE b.id = $1::uuid`,
    boletoId
  );

  const fila = filas[0];

  // Mismo mensaje si no existe o si es de otra persona, para no revelar ids.
  const noEncontrado = new ErrorBoleto(404, "No encontramos ese boleto.");
  if (!fila) throw noEncontrado;

  const esDueno = fila.comprador_id === sesion.id;
  const esAdmin = sesion.rol === "admin";
  const esPersonalDeLaCoop =
    (sesion.rol === "cooperativa" || sesion.rol === "oficinista") &&
    sesion.coopId === fila.cooperativa_id;

  if (!esDueno && !esAdmin && !esPersonalDeLaCoop) throw noEncontrado;

  return fila;
}

export async function obtenerBoleto(boletoId: string, sesion: SesionBoletos) {
  const fila = await buscarBoletoConPermiso(boletoId, sesion);
  return paraCliente(fila, true);
}
