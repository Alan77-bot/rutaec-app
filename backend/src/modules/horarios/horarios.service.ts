import { prisma } from "../../lib/prisma.js";

export class ErrorHorarios extends Error {
  estado: number;

  constructor(estado: number, mensaje: string) {
    super(mensaje);
    this.estado = estado;
  }
}

export interface DatosFrecuencia {
  codigo: string;
  ruta_id: string;
  resolucion_id: string;
  hora_salida: string;
  dias: number[];
  cooperativa_id: string;
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

export async function crearFrecuencia(datos: DatosFrecuencia) {
  const id = await prisma.$transaction(async (tx) => {
    const frecuencia = await tx.frecuencias.create({
      data: {
        cooperativa_id: datos.cooperativa_id,
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

  const [creada] = await listarFrecuencias(id);
  return creada;
}
