import { prisma } from "../../lib/prisma.js";
import { validarFrecuencia } from "./horarios.validacion.js";

export class ErrorHorarios extends Error {
  estado: number;

  constructor(estado: number, mensaje: string) {
    super(mensaje);
    this.estado = estado;
  }
}


// Prisma devuelve las columnas TIME como una fecha UTC; solo interesa HH:MM.
function horaTexto(hora: Date): string {
  return hora.toISOString().slice(11, 16);
}

export async function listarFrecuencias(frecuenciaId?: string) {
  const frecuencias = await prisma.frecuencias.findMany({
    where: frecuenciaId ? { id: frecuenciaId } : undefined,
    orderBy: [{ codigo: "asc" }],
    include: {
      cooperativas: { select: { nombre_comercial: true } },
      rutas: { select: { nombre: true } },
      resoluciones: { select: { numero: true } },
      dias_frecuencia: {
        select: { dia_iso: true },
        orderBy: { dia_iso: "asc" },
      },
    },
  });

  return frecuencias.map((f) => ({
    id: f.id,
    codigo: f.codigo,
    cooperativa_id: f.cooperativa_id,
    cooperativa: f.cooperativas.nombre_comercial,
    ruta_id: f.ruta_id,
    ruta: f.rutas.nombre,
    resolucion_id: f.resolucion_id,
    resolucion: f.resoluciones.numero,
    hora_salida: horaTexto(f.hora_salida),
    zona_horaria: f.zona_horaria,
    activa: f.activa,
    dias: f.dias_frecuencia.map((d) => d.dia_iso),
  }));
}

function fechaTexto(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

export async function listarResoluciones(cooperativaId?: string) {
  const resoluciones = await prisma.resoluciones.findMany({
    where: cooperativaId ? { cooperativa_id: cooperativaId } : undefined,
    orderBy: [{ vigente_desde: "desc" }, { numero: "asc" }],
  });

  return resoluciones.map((r) => ({
    id: r.id,
    cooperativa_id: r.cooperativa_id,
    numero: r.numero,
    autoridad: r.autoridad,
    fecha_emision: fechaTexto(r.fecha_emision),
    vigente_desde: fechaTexto(r.vigente_desde),
    vigente_hasta: r.vigente_hasta ? fechaTexto(r.vigente_hasta) : null,
  }));
}

// Convierte "HH:MM" al Date UTC que Prisma espera para columnas TIME.
function horaADate(hora: string): Date {
  return new Date(`1970-01-01T${hora}:00.000Z`);
}

// Comprueba contra la base que la ruta y la resolucion sirvan para la frecuencia.
async function verificarReferencias(
  cooperativaId: string,
  rutaId: string,
  resolucionId: string
): Promise<void> {
  const ruta = await prisma.rutas.findFirst({
    where: { id: rutaId, cooperativa_id: cooperativaId },
    select: { activa: true },
  });
  if (!ruta) {
    throw new ErrorHorarios(400, "La ruta no existe en esa cooperativa");
  }
  if (!ruta.activa) {
    throw new ErrorHorarios(400, "La ruta esta desactivada");
  }

  const resolucion = await prisma.resoluciones.findFirst({
    where: { id: resolucionId, cooperativa_id: cooperativaId },
  });
  if (!resolucion) {
    throw new ErrorHorarios(400, "La resolucion no existe en esa cooperativa");
  }
  const hoy = new Date();
  if (
    resolucion.vigente_desde > hoy ||
    (resolucion.vigente_hasta && resolucion.vigente_hasta < hoy)
  ) {
    throw new ErrorHorarios(400, "La resolucion no esta vigente");
  }
}

export async function crearFrecuencia(cuerpo: unknown, cooperativaId: string) {
  let datos;
  try {
    datos = validarFrecuencia(cuerpo);
  } catch (error) {
    throw new ErrorHorarios(400, (error as Error).message);
  }
  await verificarReferencias(cooperativaId, datos.ruta_id, datos.resolucion_id);

  let id: string;
  try {
    id = await prisma.$transaction(async (tx) => {
      const frecuencia = await tx.frecuencias.create({
        data: {
          cooperativa_id: cooperativaId,
          codigo: datos.codigo,
          ruta_id: datos.ruta_id,
          resolucion_id: datos.resolucion_id,
          hora_salida: horaADate(datos.hora_salida),
        },
      });
      await tx.dias_frecuencia.createMany({
        data: datos.dias.map((dia) => ({
          frecuencia_id: frecuencia.id,
          dia_iso: dia,
        })),
      });
      return frecuencia.id;
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      throw new ErrorHorarios(409, "Ya existe una frecuencia con ese codigo");
    }
    throw error;
  }

  const [creada] = await listarFrecuencias(id);
  return creada;
}

// cooperativaPermitida: si viene, la frecuencia debe pertenecer a esa cooperativa.
export async function actualizarFrecuencia(
  frecuenciaId: string,
  cuerpo: unknown,
  cooperativaPermitida?: string
) {
  const existente = await prisma.frecuencias.findUnique({
    where: { id: frecuenciaId },
    select: { cooperativa_id: true },
  });
  if (!existente) {
    throw new ErrorHorarios(404, "La frecuencia no existe");
  }
  if (cooperativaPermitida && existente.cooperativa_id !== cooperativaPermitida) {
    throw new ErrorHorarios(
      403,
      "No tienes permiso para modificar frecuencias de otra cooperativa"
    );
  }

  let datos;
  try {
    datos = validarFrecuencia(cuerpo);
  } catch (error) {
    throw new ErrorHorarios(400, (error as Error).message);
  }
  const cooperativaId = existente.cooperativa_id;
  // Una frecuencia que se desactiva no necesita ruta ni resolucion vigentes.
  if (datos.activa !== false) {
    await verificarReferencias(cooperativaId, datos.ruta_id, datos.resolucion_id);
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.frecuencias.update({
        where: { id: frecuenciaId },
        data: {
          codigo: datos.codigo,
          ruta_id: datos.ruta_id,
          resolucion_id: datos.resolucion_id,
          hora_salida: horaADate(datos.hora_salida),
          ...(datos.activa !== undefined ? { activa: datos.activa } : {}),
        },
      });
      await tx.dias_frecuencia.deleteMany({ where: { frecuencia_id: frecuenciaId } });
      await tx.dias_frecuencia.createMany({
        data: datos.dias.map((dia) => ({
          frecuencia_id: frecuenciaId,
          dia_iso: dia,
        })),
      });
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      throw new ErrorHorarios(409, "Ya existe una frecuencia con ese codigo");
    }
    throw error;
  }

  const [actualizada] = await listarFrecuencias(frecuenciaId);
  return actualizada;
}
