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
  cierre_ventas: Date;
  cooperativa: {
    id: string;
    nombre: string;
    color_primario: string;
    color_secundario: string;
  };
  bus: {
    id: string;
    numero_unidad: string;
    placa: string;
    pisos: number;
    capacidad: number;
    imagen_url: string | null;
    marca_chasis: string;
    marca_carroceria: string;
  };
  tarifas: { categoria: string; importe: number; moneda: string }[];
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
      pd.llegada AS llegada,
      v.cierre_ventas AS cierre_ventas,
      jsonb_build_object(
        'id', c.id,
        'nombre', c.nombre_comercial,
        'color_primario', c.color_primario,
        'color_secundario', c.color_secundario
      ) AS cooperativa,
      jsonb_build_object(
        'id', b.id,
        'numero_unidad', b.numero_unidad,
        'placa', b.placa,
        'pisos', b.pisos,
        'capacidad', b.capacidad,
        'imagen_url', b.imagen_url,
        'marca_chasis', b.marca_chasis,
        'marca_carroceria', b.marca_carroceria
      ) AS bus,
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'categoria', t.categoria,
            'importe', t.importe,
            'moneda', t.moneda
          ) ORDER BY t.categoria
        )
        FROM rutaec.tarifas_viaje t
        WHERE t.viaje_id = v.id
          AND t.origen_orden = po.orden
          AND t.destino_orden = pd.orden
          AND t.vigente_desde <= ${fecha}::date
          AND (t.vigente_hasta IS NULL OR t.vigente_hasta >= ${fecha}::date)
      ), '[]'::jsonb) AS tarifas
    FROM rutaec.viajes v
    JOIN rutaec.cooperativas c ON c.id = v.cooperativa_id
    JOIN rutaec.buses b ON b.id = v.bus_id
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
