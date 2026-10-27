import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import {
  fechaUtc,
  fechasDeOperacion,
  horariosParadas,
  hoyEn,
  instanteEnZona,
} from "./horarios.programacion.js";
import { ErrorHorarios } from "./horarios.service.js";
import { validarGeneracion, type TarifaTramo } from "./horarios.validacion.js";

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

// Motivo por el que un dia concreto no se programo (los demas siguen).
class DiaOmitido extends Error {}

export interface ViajeCreado {
  id: string;
  fecha: string;
  salida: string;
  llegada: string;
  asientos: number;
}

export interface ResultadoProgramacion {
  creados: ViajeCreado[];
  omitidos: { fecha: string; motivo: string }[];
}

function horaLocal(instante: Date, zona: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: zona,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(instante);
}

// Texto legible del error que devuelve la base (por ejemplo, de un trigger).
function mensajeBd(error: unknown): string {
  const meta = (error as { meta?: { message?: string } })?.meta?.message;
  const texto = meta ?? (error instanceof Error ? error.message : "");
  const coincidencia = /ERROR:\s*([^\n"]+)/.exec(texto);
  return coincidencia
    ? coincidencia[1].trim()
    : "La base de datos no acepto la publicacion del viaje";
}

// Tramos que se pueden vender: de una parada con subida a otra posterior con bajada.
function tramosVendibles(
  paradas: { orden: number; permite_subida: boolean; permite_bajada: boolean }[]
): [number, number][] {
  const tramos: [number, number][] = [];
  for (const o of paradas) {
    if (!o.permite_subida) continue;
    for (const d of paradas) {
      if (d.orden > o.orden && d.permite_bajada) tramos.push([o.orden, d.orden]);
    }
  }
  return tramos;
}

/**
 * Programa los viajes de una frecuencia entre dos fechas. Cada viaje se crea en
 * BORRADOR con su agenda de bus, sus paradas, la copia de los asientos activos
 * del bus y sus tarifas por tramo, y luego se publica (la base valida todo al
 * publicar). Cada dia va en su propia transaccion: si un dia falla, se informa
 * en "omitidos" y los demas se crean igual.
 */
export async function programarViajes(
  cuerpo: unknown,
  usuarioId: string,
  cooperativaPermitida?: string
): Promise<ResultadoProgramacion> {
  const frecuenciaId =
    typeof cuerpo === "object" && cuerpo !== null
      ? (cuerpo as Record<string, unknown>).frecuencia_id
      : undefined;
  if (typeof frecuenciaId !== "string") {
    throw new ErrorHorarios(400, "frecuencia_id es obligatorio");
  }

  const frecuencia = await prisma.frecuencias
    .findUnique({
      where: { id: frecuenciaId },
      include: {
        dias_frecuencia: true,
        resoluciones: true,
        rutas: {
          include: {
            paradas_ruta: {
              orderBy: { orden: "asc" },
              include: { terminales: { select: { nombre: true } } },
            },
          },
        },
      },
    })
    .catch(() => null);
  if (!frecuencia) throw new ErrorHorarios(404, "La frecuencia no existe");
  if (cooperativaPermitida && frecuencia.cooperativa_id !== cooperativaPermitida) {
    throw new ErrorHorarios(403, "No puedes programar viajes de otra cooperativa");
  }
  if (!frecuencia.activa) throw new ErrorHorarios(400, "La frecuencia esta desactivada");
  if (!frecuencia.rutas.activa) throw new ErrorHorarios(400, "La ruta de la frecuencia esta desactivada");

  const zona = frecuencia.zona_horaria;
  let datos;
  try {
    datos = validarGeneracion(cuerpo, hoyEn(zona));
  } catch (error) {
    throw new ErrorHorarios(400, (error as Error).message);
  }

  const bus = await prisma.buses.findFirst({
    where: { id: datos.bus_id, cooperativa_id: frecuencia.cooperativa_id },
    include: { asientos_bus: { where: { activo: true } } },
  });
  if (!bus) throw new ErrorHorarios(400, "El bus no existe en la cooperativa de la frecuencia");
  if (bus.estado !== "ACTIVO") throw new ErrorHorarios(400, "El bus no esta activo");
  if (bus.asientos_bus.length !== bus.capacidad) {
    throw new ErrorHorarios(
      400,
      `El bus tiene ${bus.asientos_bus.length} asientos activos y su capacidad es ${bus.capacidad}`
    );
  }
  if (bus.asientos_bus.some((a) => a.piso > bus.pisos)) {
    throw new ErrorHorarios(400, "El bus tiene asientos en un piso que no existe");
  }
  const tieneVip = bus.asientos_bus.some((a) => a.categoria === "VIP");

  const paradas = frecuencia.rutas.paradas_ruta;
  if (paradas.length < 2) throw new ErrorHorarios(400, "La ruta necesita al menos 2 paradas");
  const ultimaParada = paradas[paradas.length - 1];

  const porTramo = new Map<string, TarifaTramo>(
    datos.tarifas.map((t) => [`${t.origen_orden}-${t.destino_orden}`, t])
  );
  for (const t of datos.tarifas) {
    if (t.destino_orden > ultimaParada.orden) {
      throw new ErrorHorarios(400, `La ruta no tiene la parada ${t.destino_orden}`);
    }
  }
  for (const [o, d] of tramosVendibles(paradas)) {
    const tarifa = porTramo.get(`${o}-${d}`);
    if (!tarifa) throw new ErrorHorarios(400, `Falta la tarifa del tramo ${o} a ${d}`);
    if (tieneVip && tarifa.vip === null) {
      throw new ErrorHorarios(400, `El bus tiene asientos VIP: falta la tarifa VIP del tramo ${o} a ${d}`);
    }
  }

  const fechas = fechasDeOperacion(
    datos.desde,
    datos.hasta,
    frecuencia.dias_frecuencia.map((d) => d.dia_iso)
  );
  if (fechas.length === 0) {
    throw new ErrorHorarios(400, "La frecuencia no opera ningun dia de ese rango");
  }

  const hora = frecuencia.hora_salida.toISOString().slice(11, 16);
  const resolucion = frecuencia.resoluciones;
  const resultado: ResultadoProgramacion = { creados: [], omitidos: [] };

  for (const fecha of fechas) {
    const dia = fechaUtc(fecha);
    const inicio = instanteEnZona(fecha, hora, zona);
    const fin = new Date(inicio.getTime() + ultimaParada.minutos_desde_origen * 60000);
    const cierre = new Date(inicio.getTime() - datos.minutos_cierre * 60000);

    try {
      if (dia < resolucion.vigente_desde || (resolucion.vigente_hasta && dia > resolucion.vigente_hasta)) {
        throw new DiaOmitido("La resolucion de la frecuencia no esta vigente ese dia");
      }
      if (cierre <= new Date()) {
        throw new DiaOmitido("La venta de ese viaje ya estaria cerrada");
      }

      const id = await prisma.$transaction(
        async (tx) => {
          // Bloquea el bus para que dos programaciones no lo asignen a la vez.
          await tx.$queryRaw`SELECT id FROM rutaec.buses WHERE id = ${bus.id}::uuid FOR UPDATE`;

          const repetido = await tx.$queryRaw<{ id: string }[]>`
            SELECT v.id FROM rutaec.viajes v
            JOIN rutaec.agenda_bus a ON a.id = v.agenda_id
            WHERE v.frecuencia_id = ${frecuencia.id}::uuid
              AND v.estado <> 'CANCELADO'
              AND a.inicio = ${inicio}::timestamptz`;
          if (repetido.length > 0) {
            throw new DiaOmitido("Ya existe un viaje de esta frecuencia ese dia");
          }

          // El bus no puede tener otro viaje, descanso o mantenimiento que se cruce.
          const cruce = await tx.$queryRaw<{ tipo: string; inicio: Date; fin: Date }[]>`
            SELECT tipo, inicio, fin FROM rutaec.agenda_bus
            WHERE bus_id = ${bus.id}::uuid
              AND activa
              AND inicio < ${fin}::timestamptz
              AND fin > ${inicio}::timestamptz
            ORDER BY inicio
            LIMIT 1`;
          if (cruce.length > 0) {
            const [ocupado] = cruce;
            const que =
              ocupado.tipo === "VIAJE" ? "otro viaje" : ocupado.tipo.toLowerCase();
            throw new DiaOmitido(
              `El bus ${bus.numero_unidad} ya tiene ${que} de ${horaLocal(ocupado.inicio, zona)} a ${horaLocal(ocupado.fin, zona)}`
            );
          }

          let hoja = await tx.hojas_ruta.findUnique({
            where: { grupo_id_fecha: { grupo_id: bus.grupo_id, fecha: dia } },
          });
          if (!hoja) {
            hoja = await tx.hojas_ruta.create({
              data: {
                cooperativa_id: frecuencia.cooperativa_id,
                grupo_id: bus.grupo_id,
                fecha: dia,
                estado: "PUBLICADA",
                creado_por: usuarioId,
              },
            });
          } else if (hoja.estado !== "PUBLICADA") {
            throw new DiaOmitido(`La hoja de ruta de ese dia esta en estado ${hoja.estado}`);
          }

          const [agenda] = await tx.$queryRaw<{ id: string }[]>`
            INSERT INTO rutaec.agenda_bus (cooperativa_id, bus_id, tipo, inicio, fin)
            VALUES (${frecuencia.cooperativa_id}::uuid, ${bus.id}::uuid, 'VIAJE',
                    ${inicio}::timestamptz, ${fin}::timestamptz)
            RETURNING id`;

          const viaje = await tx.viajes.create({
            data: {
              cooperativa_id: frecuencia.cooperativa_id,
              hoja_ruta_id: hoja.id,
              frecuencia_id: frecuencia.id,
              ruta_id: frecuencia.ruta_id,
              bus_id: bus.id,
              agenda_id: agenda.id,
              estado: "BORRADOR",
              cierre_ventas: cierre,
            },
          });

          const horarios = horariosParadas(inicio, paradas);
          await tx.paradas_viaje.createMany({
            data: paradas.map((p, i) => ({
              viaje_id: viaje.id,
              orden: p.orden,
              terminal_id: p.terminal_id,
              nombre_snapshot: p.terminales.nombre,
              llegada: horarios[i].llegada,
              salida: horarios[i].salida,
              permite_subida: p.permite_subida,
              permite_bajada: p.permite_bajada,
            })),
          });

          await tx.asientos_viaje.createMany({
            data: bus.asientos_bus.map((a) => ({
              viaje_id: viaje.id,
              numero: a.numero,
              piso: a.piso,
              fila: a.fila,
              columna: a.columna,
              categoria: a.categoria,
              accesible: a.accesible,
              preferencial: a.preferencial,
            })),
          });

          await tx.tarifas_viaje.createMany({
            data: datos.tarifas.flatMap((t) => {
              const base = {
                viaje_id: viaje.id,
                origen_orden: t.origen_orden,
                destino_orden: t.destino_orden,
                fuente_normativa: datos.fuente_normativa,
                vigente_desde: dia,
              };
              const filas = [{ ...base, categoria: "NORMAL", importe: t.normal }];
              if (t.vip !== null) filas.push({ ...base, categoria: "VIP", importe: t.vip });
              return filas;
            }),
          });

          await tx.viajes.update({ where: { id: viaje.id }, data: { estado: "PUBLICADO" } });
          return viaje.id;
        },
        { timeout: 20000 }
      );

      resultado.creados.push({
        id,
        fecha,
        salida: horaLocal(inicio, zona),
        llegada: horaLocal(fin, zona),
        asientos: bus.asientos_bus.length,
      });
    } catch (error) {
      if (error instanceof DiaOmitido) {
        resultado.omitidos.push({ fecha, motivo: error.message });
      } else {
        console.error(`Error al programar el viaje del ${fecha}:`, error);
        resultado.omitidos.push({ fecha, motivo: mensajeBd(error) });
      }
    }
  }

  return resultado;
}

export const ZONA_PROGRAMACION = "America/Guayaquil";

export interface ViajeProgramado {
  id: string;
  cooperativa_id: string;
  cooperativa: string;
  ruta: string;
  frecuencia: string;
  bus: { numero_unidad: string; placa: string };
  fecha: string;
  salida: string;
  llegada: string;
  estado: string;
  cierre_ventas: string;
  motivo_cancelacion: string | null;
  asientos: number;
  vendidos: number;
  reservados: number;
}

interface FilaViaje {
  id: string;
  cooperativa_id: string;
  cooperativa: string;
  ruta: string;
  frecuencia: string;
  numero_unidad: string;
  placa: string;
  inicio: Date;
  fin: Date;
  estado: string;
  cierre_ventas: Date;
  motivo_cancelacion: string | null;
  asientos: number;
  vendidos: number;
  reservados: number;
}

function fechaLocal(instante: Date, zona: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: zona }).format(instante);
}

/**
 * Viajes cuya salida cae entre desde y hasta (fechas en hora de Ecuador), con
 * su bus, su ocupacion (asientos vendidos y reservados) y su estado.
 */
export async function listarViajes(
  desde: string,
  hasta: string,
  cooperativaId?: string
): Promise<ViajeProgramado[]> {
  const inicioRango = instanteEnZona(desde, "00:00", ZONA_PROGRAMACION);
  const finRango = new Date(
    instanteEnZona(hasta, "00:00", ZONA_PROGRAMACION).getTime() + 24 * 60 * 60000
  );
  const filtroCoop = cooperativaId
    ? Prisma.sql`AND v.cooperativa_id = ${cooperativaId}::uuid`
    : Prisma.empty;

  const filas = await prisma.$queryRaw<FilaViaje[]>`
    SELECT
      v.id, v.cooperativa_id, c.nombre_comercial AS cooperativa,
      r.nombre AS ruta, f.codigo AS frecuencia,
      b.numero_unidad, b.placa,
      a.inicio, a.fin, v.estado, v.cierre_ventas, v.motivo_cancelacion,
      (SELECT count(*)::int FROM rutaec.asientos_viaje s WHERE s.viaje_id = v.id) AS asientos,
      (SELECT count(DISTINCT d.asiento_id)::int FROM rutaec.detalle_compra d
        WHERE d.viaje_id = v.id AND d.estado = 'CONFIRMADO') AS vendidos,
      (SELECT count(DISTINCT d.asiento_id)::int FROM rutaec.detalle_compra d
        WHERE d.viaje_id = v.id AND d.estado = 'RETENIDO') AS reservados
    FROM rutaec.viajes v
    JOIN rutaec.cooperativas c ON c.id = v.cooperativa_id
    JOIN rutaec.rutas r ON r.id = v.ruta_id
    JOIN rutaec.frecuencias f ON f.id = v.frecuencia_id
    JOIN rutaec.buses b ON b.id = v.bus_id
    JOIN rutaec.agenda_bus a ON a.id = v.agenda_id
    WHERE a.inicio >= ${inicioRango}::timestamptz
      AND a.inicio < ${finRango}::timestamptz
      ${filtroCoop}
    ORDER BY a.inicio, r.nombre`;

  return filas.map((v) => ({
    id: v.id,
    cooperativa_id: v.cooperativa_id,
    cooperativa: v.cooperativa,
    ruta: v.ruta,
    frecuencia: v.frecuencia,
    bus: { numero_unidad: v.numero_unidad, placa: v.placa },
    fecha: fechaLocal(v.inicio, ZONA_PROGRAMACION),
    salida: horaLocal(v.inicio, ZONA_PROGRAMACION),
    llegada: horaLocal(v.fin, ZONA_PROGRAMACION),
    estado: v.estado,
    cierre_ventas: v.cierre_ventas.toISOString(),
    motivo_cancelacion: v.motivo_cancelacion,
    asientos: v.asientos,
    vendidos: v.vendidos,
    reservados: v.reservados,
  }));
}
