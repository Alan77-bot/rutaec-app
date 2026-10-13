import { prisma } from "../../lib/prisma.js";

export async function obtenerResumenAdministracion() {
  const [
    totalCooperativas,
    cooperativasActivas,
    cooperativasInactivas,
    totalBuses,
    totalUsuarios,
  ] = await prisma.$transaction([
    prisma.cooperativas.count(),
    prisma.cooperativas.count({
      where: { activa: true },
    }),
    prisma.cooperativas.count({
      where: { activa: false },
    }),
    prisma.buses.count(),
    prisma.usuarios.count(),
  ]);

  return {
    totalCooperativas,
    cooperativasActivas,
    cooperativasInactivas,
    totalBuses,
    totalUsuarios,
  };
}