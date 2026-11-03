import { prisma } from "../../lib/prisma.js";
import type { SesionAutenticada } from "../../middlewares/autenticacion.js";

const SIN_RESULTADOS = "00000000-0000-0000-0000-000000000000";

export class ErrorPago extends Error {
  estado: number;
  constructor(estado: number, mensaje: string) {
    super(mensaje);
    this.estado = estado;
  }
}

function filtroPorSesion(sesion: SesionAutenticada) {
  if (sesion.rol === "admin") return {};
  if (sesion.rol === "usuario") {
    return { compras: { comprador_id: sesion.id } };
  }
  return { cooperativa_id: sesion.coopId ?? SIN_RESULTADOS };
}

const CAMPOS_LISTA = {
  id: true,
  compra_id: true,
  cooperativa_id: true,
  metodo: true,
  estado: true,
  importe: true,
  moneda: true,
  cuenta_bancaria_id: true,
  creado_en: true,
  aprobado_en: true,
} as const;

export async function listarPagos(sesion: SesionAutenticada) {
  return prisma.pagos.findMany({
    where: filtroPorSesion(sesion),
    select: CAMPOS_LISTA,
    orderBy: { creado_en: "desc" },
  });
}

export async function listarPagosPendientes(sesion: SesionAutenticada) {
  return prisma.pagos.findMany({
    where: {
      ...filtroPorSesion(sesion),
      estado: { in: ["PENDIENTE", "EN_REVISION"] },
    },
    select: CAMPOS_LISTA,
    orderBy: { creado_en: "asc" },
  });
}
