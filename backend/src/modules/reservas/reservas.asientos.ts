import type { PrismaClient } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";

// Acepta el cliente normal o el de una transaccion, para poder probar la
// consulta dentro de una transaccion que luego se deshace.
export type ClienteBd = Pick<PrismaClient, "$queryRaw">;

export type CategoriaAsiento = "NORMAL" | "VIP";

export type AsientoDisponible = {
  id: string;
  numero: string;
  piso: number;
  fila: number;
  columna: number;
  categoria: CategoriaAsiento;
  accesible: boolean;
  preferencial: boolean;
  estado: "LIBRE" | "OCUPADO" | "NO_VENDIBLE";
};

// Paradas (por orden dentro del viaje) entre las que viaja el pasajero.
export type TramoPasajero = {
  origenOrden: number;
  destinoOrden: number;
};

/**
 * Asientos de un viaje, ordenados por piso, fila y columna. Son los asientos
 * "congelados" al publicar el viaje (asientos_viaje), no los del bus, para que
 * un cambio posterior en el bus no altere viajes ya vendidos.
 *
 * Un asiento esta OCUPADO si tiene una venta confirmada cuyo tramo se cruza con
 * el del pasajero: el mismo asiento puede venderse a quien viaja en un tramo
 * distinto del recorrido.
 */
export async function listarAsientosViaje(
  viajeId: string,
  tramo: TramoPasajero,
  bd: ClienteBd = prisma
): Promise<AsientoDisponible[]> {
  return bd.$queryRaw<AsientoDisponible[]>`
    SELECT
      s.id AS id,
      s.numero AS numero,
      s.piso::int AS piso,
      s.fila::int AS fila,
      s.columna::int AS columna,
      s.categoria AS categoria,
      s.accesible AS accesible,
      s.preferencial AS preferencial,
      CASE
        WHEN NOT s.vendible THEN 'NO_VENDIBLE'
        WHEN EXISTS (
          SELECT 1
          FROM rutaec.detalle_compra d
          WHERE d.viaje_id = s.viaje_id
            AND d.asiento_id = s.id
            AND d.estado = 'CONFIRMADO'
            AND d.tramo && int4range(${tramo.origenOrden}::int, ${tramo.destinoOrden}::int, '[)')
        ) THEN 'OCUPADO'
        ELSE 'LIBRE'
      END AS estado
    FROM rutaec.asientos_viaje s
    WHERE s.viaje_id = ${viajeId}::uuid
    ORDER BY s.piso, s.fila, s.columna
  `;
}
