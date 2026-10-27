import { prisma } from "../../lib/prisma.js";

export interface BusProgramable {
  id: string;
  cooperativa_id: string;
  numero_unidad: string;
  placa: string;
  pisos: number;
  capacidad: number;
  estado: string;
  asientos_activos: number;
  asientos_vip: number;
}

// Buses con los datos que se necesitan para asignarlos a un viaje. Un bus solo
// se puede publicar si tiene exactamente "capacidad" asientos activos.
export async function listarBuses(cooperativaId?: string): Promise<BusProgramable[]> {
  const buses = await prisma.buses.findMany({
    where: cooperativaId ? { cooperativa_id: cooperativaId } : undefined,
    orderBy: [{ numero_unidad: "asc" }],
    include: {
      asientos_bus: { where: { activo: true }, select: { categoria: true } },
    },
  });

  return buses.map((b) => ({
    id: b.id,
    cooperativa_id: b.cooperativa_id,
    numero_unidad: b.numero_unidad,
    placa: b.placa,
    pisos: b.pisos,
    capacidad: b.capacidad,
    estado: b.estado,
    asientos_activos: b.asientos_bus.length,
    asientos_vip: b.asientos_bus.filter((a) => a.categoria === "VIP").length,
  }));
}
