import { prisma } from "../../lib/prisma.js";

export async function listarPagos() {
  return prisma.pagos.findMany({
    select: {
      id: true,
      compra_id: true,
      cooperativa_id: true,
      metodo: true,
      estado: true,
      importe: true,
      moneda: true,
      creado_en: true,
      aprobado_en: true,
    },
    orderBy: { creado_en: "desc" },
  });
}

export async function listarPagosPendientes() {
  return prisma.pagos.findMany({
    where: { estado: { in: ["PENDIENTE", "EN_REVISION"] } },
    orderBy: { creado_en: "asc" },
  });
}
