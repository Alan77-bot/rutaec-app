import { prisma } from "../../lib/prisma.js";

export type BusquedaViajes = {
  origen: string;
  destino: string;
  fecha: string;
};

export type ViajeEncontrado = {
  viaje_id: string;
  origen_orden: number;
  destino_orden: number;
  origen_terminal: string;
  destino_terminal: string;
  salida: Date;
  llegada: Date;
};

const ZONA_HORARIA = "America/Guayaquil";

/**
 * Busca viajes que pasen por la ciudad de origen y luego por la de destino
 * (en ese orden) y cuya salida desde el origen caiga en la fecha indicada.
 * Respeta las paradas donde se permite subir y bajar.
 */
export async function buscarViajes({
  origen,
  destino,
  fecha,
}: BusquedaViajes): Promise<ViajeEncontrado[]> {
  return prisma.$queryRaw<ViajeEncontrado[]>`
    SELECT
      v.id AS viaje_id,
      po.orden AS origen_orden,
      pd.orden AS destino_orden,
      po.nombre_snapshot AS origen_terminal,
      pd.nombre_snapshot AS destino_terminal,
      po.salida AS salida,
      pd.llegada AS llegada
    FROM rutaec.viajes v
    JOIN rutaec.paradas_viaje po
      ON po.viaje_id = v.id AND po.permite_subida
    JOIN rutaec.terminales tor ON tor.id = po.terminal_id
    JOIN rutaec.ciudades co ON co.id = tor.ciudad_id
    JOIN rutaec.paradas_viaje pd
      ON pd.viaje_id = v.id AND pd.orden > po.orden AND pd.permite_bajada
    JOIN rutaec.terminales tde ON tde.id = pd.terminal_id
    JOIN rutaec.ciudades cd ON cd.id = tde.ciudad_id
    WHERE lower(co.nombre) = lower(${origen})
      AND lower(cd.nombre) = lower(${destino})
      AND (po.salida AT TIME ZONE ${ZONA_HORARIA})::date = ${fecha}::date
    ORDER BY po.salida
  `;
}
