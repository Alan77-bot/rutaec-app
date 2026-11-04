import { prisma } from "../../lib/prisma.js";

export interface DatosAsiento {
  numero: string;
  piso: number;
  fila: number;
  columna: number;
  categoria: string;
  preferencial: boolean;
  accesible: boolean;
  activo: boolean;
}

function fallo(error: string, estado: number) {
  return { error, estado };
}

export async function consultarDistribucionBus(
  busId: string,
  cooperativaId: string
) {
  const bus = await prisma.buses.findFirst({
    where: { id: busId, cooperativa_id: cooperativaId },
    select: {
      id: true,
      placa: true,
      numero_unidad: true,
      pisos: true,
      capacidad: true,
      asientos_bus: {
        orderBy: [
          { piso: "asc" },
          { fila: "asc" },
          { columna: "asc" },
        ],
      },
    },
  });

  if (!bus) {
    return fallo("Bus no encontrado en esta cooperativa", 404);
  }

  return {
    datos: {
      busId: bus.id,
      placa: bus.placa,
      numeroUnidad: bus.numero_unidad,
      pisos: bus.pisos,
      capacidad: bus.capacidad,
      totalAsientos: bus.asientos_bus.length,
      asientos: bus.asientos_bus,
    },
  };
}

export async function actualizarDistribucionBus(
  busId: string,
  cooperativaId: string,
  asientos: DatosAsiento[]
) {
  return prisma.$transaction(async (tx) => {
    const buses = await tx.$queryRaw<
      { id: string; pisos: number; capacidad: number }[]
    >`
      SELECT id, pisos, capacidad
      FROM rutaec.buses
      WHERE id = ${busId}::uuid
        AND cooperativa_id = ${cooperativaId}::uuid
      FOR UPDATE
    `;

    const bus = buses[0];

    if (!bus) {
      return fallo("Bus no encontrado en esta cooperativa", 404);
    }

    if (asientos.length !== bus.capacidad) {
      return fallo(
        `La distribucion debe contener exactamente ${bus.capacidad} asientos`,
        400
      );
    }

    const numeros = new Set<string>();
    const posiciones = new Set<string>();

    for (const asiento of asientos) {
      if (
        asiento.piso < 1 ||
        asiento.piso > bus.pisos ||
        asiento.fila < 1 ||
        asiento.columna < 1
      ) {
        return fallo("Hay posiciones fuera de los limites del bus", 400);
      }

      const numero = asiento.numero.trim().toUpperCase();
      const posicion =
        `${asiento.piso}-${asiento.fila}-${asiento.columna}`;

      if (numeros.has(numero) || posiciones.has(posicion)) {
        return fallo("Hay numeros o posiciones duplicadas", 400);
      }

      numeros.add(numero);
      posiciones.add(posicion);
    }

    const viaje = await tx.viajes.findFirst({
      where: {
        bus_id: busId,
        cooperativa_id: cooperativaId,
      },
      select: { id: true },
    });

    if (viaje) {
      return fallo(
        "No se puede reemplazar la distribucion de un bus con viajes registrados",
        409
      );
    }

    await tx.asientos_bus.deleteMany({
      where: { bus_id: busId },
    });

    await tx.asientos_bus.createMany({
      data: asientos.map((asiento) => ({
        bus_id: busId,
        numero: asiento.numero.trim().toUpperCase(),
        piso: asiento.piso,
        fila: asiento.fila,
        columna: asiento.columna,
        categoria: asiento.categoria.trim().toUpperCase(),
        preferencial: asiento.preferencial,
        accesible: asiento.accesible,
        activo: asiento.activo,
      })),
    });

    const guardados = await tx.asientos_bus.findMany({
      where: { bus_id: busId },
      orderBy: [
        { piso: "asc" },
        { fila: "asc" },
        { columna: "asc" },
      ],
    });

    return {
      datos: {
        busId,
        capacidad: bus.capacidad,
        pisos: bus.pisos,
        totalAsientos: guardados.length,
        asientos: guardados,
      },
    };
  });
}
