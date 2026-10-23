import { prisma } from "../../lib/prisma.js";

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
