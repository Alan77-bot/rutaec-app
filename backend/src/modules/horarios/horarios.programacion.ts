// Calculos de fechas y horas para programar viajes a partir de una frecuencia.
// Son funciones puras (sin base de datos) para poder probarlas facilmente.

const UN_DIA_MS = 24 * 60 * 60 * 1000;

// "YYYY-MM-DD" -> Date a medianoche UTC (asi se guardan las columnas DATE).
export function fechaUtc(fecha: string): Date {
  return new Date(`${fecha}T00:00:00.000Z`);
}

export function textoFecha(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

// Dia ISO de una fecha: 1 = lunes ... 7 = domingo.
export function diaIso(fecha: string): number {
  const dia = fechaUtc(fecha).getUTCDay();
  return dia === 0 ? 7 : dia;
}

// Fecha de hoy en la zona horaria indicada, como "YYYY-MM-DD".
export function hoyEn(zona: string, ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: zona }).format(ahora);
}

// Diferencia en minutos entre la hora local de la zona y UTC en un instante.
function desfaseMinutos(instante: Date, zona: string): number {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: zona,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(instante);
  const valor = (tipo: string) =>
    Number(partes.find((p) => p.type === tipo)?.value ?? 0);
  const comoUtc = Date.UTC(
    valor("year"),
    valor("month") - 1,
    valor("day"),
    valor("hour"),
    valor("minute")
  );
  return Math.round((comoUtc - instante.getTime()) / 60000);
}

// Instante exacto de una fecha y hora "HH:MM" expresadas en la zona indicada.
export function instanteEnZona(fecha: string, hora: string, zona: string): Date {
  const supuesto = new Date(`${fecha}T${hora}:00.000Z`);
  const desfase = desfaseMinutos(supuesto, zona);
  return new Date(supuesto.getTime() - desfase * 60000);
}

// Fechas entre desde y hasta (incluidas) en que opera la frecuencia.
export function fechasDeOperacion(
  desde: string,
  hasta: string,
  dias: number[]
): string[] {
  const fechas: string[] = [];
  const fin = fechaUtc(hasta).getTime();
  for (let t = fechaUtc(desde).getTime(); t <= fin; t += UN_DIA_MS) {
    const fecha = textoFecha(new Date(t));
    if (dias.includes(diaIso(fecha))) fechas.push(fecha);
  }
  return fechas;
}

export interface ParadaRutaBase {
  orden: number;
  minutos_desde_origen: number;
}

export interface HorarioParada {
  orden: number;
  llegada: Date;
  salida: Date;
}

// Minutos que el bus se detiene en cada parada intermedia.
export const MINUTOS_PARADA = 5;

// Llegada y salida de cada parada. En el origen y en el destino coinciden; en
// las intermedias el bus espera unos minutos sin alcanzar la siguiente parada.
export function horariosParadas(
  inicio: Date,
  paradas: ParadaRutaBase[]
): HorarioParada[] {
  const ordenadas = [...paradas].sort((a, b) => a.orden - b.orden);
  const ultima = ordenadas.length - 1;

  return ordenadas.map((p, i) => {
    const llegada = new Date(inicio.getTime() + p.minutos_desde_origen * 60000);
    if (i === 0 || i === ultima) return { orden: p.orden, llegada, salida: llegada };

    const siguiente = ordenadas[i + 1].minutos_desde_origen;
    const espera = Math.min(MINUTOS_PARADA, siguiente - p.minutos_desde_origen);
    return {
      orden: p.orden,
      llegada,
      salida: new Date(llegada.getTime() + espera * 60000),
    };
  });
}
