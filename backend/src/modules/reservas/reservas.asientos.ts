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
  estado: "LIBRE" | "NO_VENDIBLE";
};

/**
 * Asientos de un viaje, ordenados por piso, fila y columna. Son los asientos
 * "congelados" al publicar el viaje (asientos_viaje), no los del bus, para que
 * un cambio posterior en el bus no altere viajes ya vendidos.
 */
export async function listarAsientosViaje(
  viajeId: string,
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
      CASE WHEN s.vendible THEN 'LIBRE' ELSE 'NO_VENDIBLE' END AS estado
    FROM rutaec.asientos_viaje s
    WHERE s.viaje_id = ${viajeId}::uuid
    ORDER BY s.piso, s.fila, s.columna
  `;
}
