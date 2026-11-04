import { prisma } from "../../lib/prisma.js";
import { extraerToken } from "./boletos.qr.js";
import {
  ErrorBoleto,
  esUuid,
  type DatosEmision,
  type SesionBoletos,
} from "./boletos.service.js";

// Se puede abordar desde 3 horas antes de la salida hasta la llegada del bus.
const ANTES_DE_SALIDA_MS = 3 * 60 * 60 * 1000;

export type ResultadoVerificacion =
  | "VALIDO"
  | "ANULADO"
  | "YA_ABORDADO"
  | "VIAJE_INCORRECTO"
  | "VIAJE_CANCELADO"
  | "FUERA_DE_HORARIO"
  | "NO_ENCONTRADO";

type FilaVerificacion = {
  id: string;
  codigo: string;
  estado: string;
  cooperativa_id: string;
  viaje_id: string;
  viaje_estado: string;
  datos_emision: DatosEmision;
  abordado_en: Date | null;
};

const MENSAJES: Record<ResultadoVerificacion, string> = {
  VALIDO: "Boleto válido. Puede abordar.",
  ANULADO: "El boleto fue anulado.",
  YA_ABORDADO: "Este boleto ya se utilizó para abordar.",
  VIAJE_INCORRECTO: "El boleto corresponde a otro viaje.",
  VIAJE_CANCELADO: "El viaje de este boleto fue cancelado.",
  FUERA_DE_HORARIO: "El boleto no está vigente en este horario.",
  NO_ENCONTRADO: "No existe un boleto con ese código.",
};

// Solo el personal de la cooperativa dueña del viaje (o el administrador) verifica boletos.
export function puedeVerificar(sesion: SesionBoletos, cooperativaId: string): boolean {
  if (sesion.rol === "admin") return true;
  return (
    (sesion.rol === "cooperativa" || sesion.rol === "oficinista") &&
    sesion.coopId === cooperativaId
  );
}

export async function buscarParaVerificar(contenido: unknown): Promise<FilaVerificacion | null> {
  const token = extraerToken(contenido);
  if (!token) throw new ErrorBoleto(400, "El código QR no tiene un formato válido.");

  const filas = await prisma.$queryRawUnsafe<FilaVerificacion[]>(
    `SELECT b.id::text AS id, b.codigo::text AS codigo, b.estado,
            c.cooperativa_id::text AS cooperativa_id, c.viaje_id::text AS viaje_id,
            v.estado AS viaje_estado, b.datos_emision,
            (SELECT e.creado_en FROM rutaec.eventos_salida e
              WHERE e.clave_deduplicacion = 'abordaje:' || b.id::text) AS abordado_en
       FROM rutaec.boletos b
       JOIN rutaec.compras c ON c.id = b.compra_id
       JOIN rutaec.viajes v ON v.id = c.viaje_id
      WHERE b.qr_token = $1::uuid`,
    token
  );

  return filas[0] ?? null;
}

export function evaluarBoleto(
  fila: FilaVerificacion,
  viajeEsperado?: string,
  ahora: Date = new Date()
): ResultadoVerificacion {
  if (fila.estado !== "EMITIDO") return "ANULADO";
  if (viajeEsperado && viajeEsperado !== fila.viaje_id) return "VIAJE_INCORRECTO";
  if (fila.viaje_estado === "CANCELADO") return "VIAJE_CANCELADO";
  if (fila.abordado_en) return "YA_ABORDADO";

  const salida = new Date(fila.datos_emision.salida).getTime();
  const llegada = new Date(fila.datos_emision.llegada).getTime();
  const t = ahora.getTime();

  if (Number.isNaN(salida) || Number.isNaN(llegada)) return "FUERA_DE_HORARIO";
  if (t < salida - ANTES_DE_SALIDA_MS || t > llegada) return "FUERA_DE_HORARIO";

  return "VALIDO";
}

export async function verificarQr(
  contenido: unknown,
  sesion: SesionBoletos,
  viajeEsperado?: unknown
) {
  if (viajeEsperado !== undefined && !esUuid(viajeEsperado)) {
    throw new ErrorBoleto(400, "El identificador del viaje no es válido.");
  }

  const fila = await buscarParaVerificar(contenido);

  // Quien no es personal autorizado no puede distinguir un boleto de otra cooperativa
  // de uno inexistente.
  if (!fila || !puedeVerificar(sesion, fila.cooperativa_id)) {
    return { resultado: "NO_ENCONTRADO" as const, mensaje: MENSAJES.NO_ENCONTRADO };
  }

  const resultado = evaluarBoleto(fila, viajeEsperado as string | undefined);
  const d = fila.datos_emision;

  return {
    resultado,
    mensaje: MENSAJES[resultado],
    boleto: {
      id: fila.id,
      codigo: fila.codigo.slice(0, 8).toUpperCase(),
      pasajero: `${d.pasajero.nombres ?? ""} ${d.pasajero.apellidos ?? ""}`.trim(),
      asiento: d.asiento.numero ?? null,
      origen: d.origen,
      destino: d.destino,
      salida: d.salida,
      viajeId: fila.viaje_id,
    },
  };
}
