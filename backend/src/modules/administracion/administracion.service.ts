
import { prisma } from "../../lib/prisma.js";

export async function obtenerResumenAdministracion() {
  const [totalCooperativas, totalBuses, totalUsuarios] =
    await prisma.$transaction([
      prisma.cooperativas.count(),
      prisma.buses.count(),
      prisma.usuarios.count(),
    ]);

  return {
    totalCooperativas,
    totalBuses,
    totalUsuarios,
  };
}
