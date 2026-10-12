
import { prisma } from "../../lib/prisma.js";

export async function listarCooperativas() {
  return prisma.cooperativas.findMany({
    select: {
      id: true,
      nombre_comercial: true,
      razon_social: true,
      activa: true,
    },
  });
}
