import { prisma } from "../../lib/prisma.js";

export async function listarBusesPorCooperativa(cooperativaId: string) {
  return prisma.buses.findMany({
    where: { cooperativa_id: cooperativaId },
    select: {
      id: true,
      cooperativa_id: true,
      grupo_id: true,
      placa: true,
      numero_unidad: true,
      color: true,
      marca_chasis: true,
      marca_carroceria: true,
      anio: true,
      pisos: true,
      capacidad: true,
      imagen_url: true,
      estado: true,
      grupos_buses: {
        select: {
          id: true,
          nombre: true,
          tipo: true,
        },
      },
      bus_comodidades: {
        select: {
          comodidad: true,
          comodidades: {
            select: { nombre: true },
          },
        },
      },
    },
    orderBy: { numero_unidad: "asc" },
  });
}
