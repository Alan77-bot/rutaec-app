import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";

export type BusquedaViajes = {
  origen: string;
  destino: string;
  fecha: string;
};

export type ParadaRecorrido = {
  orden: number;
  terminal: string;
  llegada: Date;
  salida: Date;
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
  cupos_disponibles: number;
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
  paradas: ParadaRecorrido[];
};

const ZONA_HORARIA = "America/Guayaquil";

// Reglas que debe cumplir un viaje para poder comprarse: son las mismas que
// valida reservar_compra. Requiere los alias v (viajes), c (cooperativas) y
// fr (frecuencias), y se comparte para que ninguna consulta se desajuste.
const VIAJE_VENDIBLE = Prisma.sql`
  v.estado = 'PUBLICADO'
  AND v.cierre_ventas > clock_timestamp()
  AND c.activa
  AND fr.activa`;

/**
 * Busca viajes que pasen por la ciudad de origen y luego por la de destino
 * (en ese orden) y cuya salida desde el origen caiga en la fecha indicada.
 * Respeta las paradas donde se permite subir y bajar y solo incluye viajes
 * publicados con ventas abiertas, de cooperativas y frecuencias activas, igual
 * que exige reservar_compra.
 *
 * cupos_disponibles es la capacidad vendible menos la ocupacion mas alta de los
 * tramos que recorre el pasajero (un asiento ocupado en cualquiera de ellos no
 * sirve), contando ventas confirmadas y retenciones vigentes.
 *
 * paradas es el recorrido del pasajero: desde su terminal de origen hasta la de
 * destino, con las paradas intermedias en orden y sus horas.
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
      (
        SELECT COALESCE(MIN(o.capacidad_vendible - o.vendidos - o.retenidos), 0)::int
        FROM rutaec.v_ocupacion_tramos o
        WHERE o.viaje_id = v.id
          AND o.tramo_inicio >= po.orden
          AND o.tramo_inicio < pd.orden
      ) AS cupos_disponibles,
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
      ), '[]'::jsonb) AS tarifas,
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'orden', ps.orden,
            'terminal', ps.nombre_snapshot,
            'llegada', ps.llegada,
            'salida', ps.salida
          ) ORDER BY ps.orden
        )
        FROM rutaec.paradas_viaje ps
        WHERE ps.viaje_id = v.id
          AND ps.orden BETWEEN po.orden AND pd.orden
      ) AS paradas
    FROM rutaec.viajes v
    JOIN rutaec.cooperativas c ON c.id = v.cooperativa_id
    JOIN rutaec.frecuencias fr ON fr.id = v.frecuencia_id
    JOIN rutaec.buses b ON b.id = v.bus_id
    JOIN rutaec.paradas_viaje po
      ON po.viaje_id = v.id AND po.permite_subida
    JOIN rutaec.terminales tor ON tor.id = po.terminal_id
    JOIN rutaec.ciudades co ON co.id = tor.ciudad_id
    JOIN rutaec.paradas_viaje pd
      ON pd.viaje_id = v.id AND pd.orden > po.orden AND pd.permite_bajada
    JOIN rutaec.terminales tde ON tde.id = pd.terminal_id
    JOIN rutaec.ciudades cd ON cd.id = tde.ciudad_id
    WHERE ${VIAJE_VENDIBLE}
      AND lower(co.nombre) = lower(${origen})
      AND lower(cd.nombre) = lower(${destino})
      AND (po.salida AT TIME ZONE ${ZONA_HORARIA})::date = ${fecha}::date
    ORDER BY po.salida
  `;
}

export type CiudadDisponible = {
  nombre: string;
  provincia: string;
};

/**
 * Ciudades por las que pasa al menos un viaje que todavia se puede comprar.
 * Sirve para llenar los selectores de origen y destino sin ofrecer ciudades
 * sin servicio.
 */
export async function listarCiudadesDisponibles(): Promise<CiudadDisponible[]> {
  return prisma.$queryRaw<CiudadDisponible[]>`
    SELECT DISTINCT ci.nombre AS nombre, ci.provincia AS provincia
    FROM rutaec.viajes v
    JOIN rutaec.cooperativas c ON c.id = v.cooperativa_id
    JOIN rutaec.frecuencias fr ON fr.id = v.frecuencia_id
    JOIN rutaec.paradas_viaje pv ON pv.viaje_id = v.id
    JOIN rutaec.terminales te ON te.id = pv.terminal_id
    JOIN rutaec.ciudades ci ON ci.id = te.ciudad_id
    WHERE ${VIAJE_VENDIBLE}
    ORDER BY ci.nombre
  `;
}
