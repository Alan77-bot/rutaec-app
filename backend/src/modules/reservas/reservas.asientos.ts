import { prisma } from "../../lib/prisma.js";
import {
  buscarViajePorId,
  type ClienteBd,
  type ViajeEncontrado,
} from "./reservas.service.js";

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
  estado: "LIBRE" | "OCUPADO" | "RETENIDO" | "NO_VENDIBLE";
};

export type AsientoConPrecio = AsientoDisponible & {
  // Importe de la tarifa de su categoria en el tramo; null si no hay tarifa.
  precio: number | null;
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
 *
 * Esta RETENIDO si otra persona lo reservo y todavia no se vendio: la reserva
 * dura 5 minutos, o sigue vigente mientras su pago esta en revision. Son las
 * mismas condiciones que usa la vista v_ocupacion_tramos.
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
        WHEN EXISTS (
          SELECT 1
          FROM rutaec.detalle_compra d
          JOIN rutaec.compras c ON c.id = d.compra_id
          WHERE d.viaje_id = s.viaje_id
            AND d.asiento_id = s.id
            AND d.estado = 'RETENIDO'
            AND d.tramo && int4range(${tramo.origenOrden}::int, ${tramo.destinoOrden}::int, '[)')
            AND (
              c.estado = 'EN_REVISION'
              OR (c.estado = 'RESERVADA' AND c.vence_en > clock_timestamp())
            )
        ) THEN 'RETENIDO'
        ELSE 'LIBRE'
      END AS estado
    FROM rutaec.asientos_viaje s
    WHERE s.viaje_id = ${viajeId}::uuid
    ORDER BY s.piso, s.fila, s.columna
  `;
}

// Una parada del recorrido completo del viaje, con la ciudad a la que pertenece
// y si en ella se puede subir o bajar.
export type ParadaViaje = {
  orden: number;
  terminal: string;
  ciudad: string;
  llegada: Date;
  salida: Date;
  permite_subida: boolean;
  permite_bajada: boolean;
};

export type DisponibilidadViaje = {
  viaje: ViajeEncontrado;
  // Todas las paradas del viaje, no solo las del tramo del pasajero: sirven para
  // que pueda cambiar donde sube o baja.
  recorrido: ParadaViaje[];
  asientos: AsientoConPrecio[];
};

/** Recorrido completo de un viaje, en orden, con la ciudad de cada parada. */
export async function listarRecorridoViaje(
  viajeId: string,
  bd: ClienteBd = prisma
): Promise<ParadaViaje[]> {
  return bd.$queryRaw<ParadaViaje[]>`
    SELECT
      p.orden::int AS orden,
      p.nombre_snapshot AS terminal,
      c.nombre AS ciudad,
      p.llegada AS llegada,
      p.salida AS salida,
      p.permite_subida AS permite_subida,
      p.permite_bajada AS permite_bajada
    FROM rutaec.paradas_viaje p
    JOIN rutaec.terminales t ON t.id = p.terminal_id
    JOIN rutaec.ciudades c ON c.id = t.ciudad_id
    WHERE p.viaje_id = ${viajeId}::uuid
    ORDER BY p.orden
  `;
}

/**
 * Datos del viaje y de cada asiento para el tramo que quiere recorrer el
 * pasajero, con su estado y su precio. Devuelve null si el viaje no existe,
 * ya no se puede comprar o no pasa por esas ciudades en ese orden.
 */
export async function obtenerDisponibilidad(
  viajeId: string,
  origen: string,
  destino: string,
  bd: ClienteBd = prisma
): Promise<DisponibilidadViaje | null> {
  const viaje = await buscarViajePorId(viajeId, origen, destino, bd);

  if (!viaje) return null;

  const [recorrido, asientos] = await Promise.all([
    listarRecorridoViaje(viajeId, bd),
    listarAsientosViaje(
      viajeId,
      { origenOrden: viaje.origen_orden, destinoOrden: viaje.destino_orden },
      bd
    ),
  ]);

  const precioPorCategoria = new Map(
    viaje.tarifas.map((t) => [t.categoria, Number(t.importe)])
  );

  return {
    viaje,
    recorrido,
    asientos: asientos.map((a) => ({
      ...a,
      precio: precioPorCategoria.get(a.categoria) ?? null,
    })),
  };
}
