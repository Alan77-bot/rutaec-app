import { prisma } from "../../lib/prisma.js";

export async function listarCiudades() {
  return prisma.ciudades.findMany({
    orderBy: [{ provincia: "asc" }, { nombre: "asc" }],
  });
}
