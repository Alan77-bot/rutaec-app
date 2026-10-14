import { prisma } from "../../lib/prisma.js";

export async function listarCiudades() {
  return prisma.ciudades.findMany({
    orderBy: [{ provincia: "asc" }, { nombre: "asc" }],
  });
}

export async function listarTerminales() {
  return prisma.terminales.findMany({
    include: {
      ciudades: { select: { nombre: true, provincia: true } },
    },
    orderBy: { nombre: "asc" },
  });
}
