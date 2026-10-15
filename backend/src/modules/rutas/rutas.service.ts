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

export async function listarRutas(rutaId?: string) {
  const rutas = await prisma.rutas.findMany({
    where: rutaId ? { id: rutaId } : {},
    include: {
      cooperativas: { select: { nombre_comercial: true } },
      paradas_ruta: {
        orderBy: { orden: "asc" },
        include: {
          terminales: {
            include: { ciudades: { select: { nombre: true, provincia: true } } },
          },
        },
      },
    },
    orderBy: { nombre: "asc" },
  });

  return rutas.map((ruta) => {
    const paradas = ruta.paradas_ruta;
    return {
      id: ruta.id,
      cooperativa_id: ruta.cooperativa_id,
      cooperativa: ruta.cooperativas.nombre_comercial,
      nombre: ruta.nombre,
      version: ruta.version,
      activa: ruta.activa,
      origen: paradas[0]?.terminales.ciudades.nombre ?? null,
      destino: paradas[paradas.length - 1]?.terminales.ciudades.nombre ?? null,
      paradas: paradas.map((p) => ({
        orden: p.orden,
        terminal_id: p.terminal_id,
        terminal: p.terminales.nombre,
        ciudad: p.terminales.ciudades.nombre,
        minutos_desde_origen: p.minutos_desde_origen,
        permite_subida: p.permite_subida,
        permite_bajada: p.permite_bajada,
      })),
    };
  });
}
