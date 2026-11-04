const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface FrecuenciaValidada {
  codigo: string;
  ruta_id: string;
  resolucion_id: string;
  hora_salida: string;
  dias: number[];
  activa?: boolean;
}

export function validarFrecuencia(cuerpo: unknown): FrecuenciaValidada {
  if (typeof cuerpo !== "object" || cuerpo === null) {
    throw new Error("El cuerpo de la solicitud no es valido");
  }
  const x = cuerpo as Record<string, unknown>;

  const codigo = typeof x.codigo === "string" ? x.codigo.trim() : "";
  if (codigo.length < 1 || codigo.length > 30) {
    throw new Error("El codigo es obligatorio y admite hasta 30 caracteres");
  }
  if (typeof x.ruta_id !== "string" || !UUID.test(x.ruta_id)) {
    throw new Error("ruta_id debe ser un UUID valido");
  }
  if (typeof x.resolucion_id !== "string" || !UUID.test(x.resolucion_id)) {
    throw new Error("resolucion_id debe ser un UUID valido");
  }
  if (typeof x.hora_salida !== "string" || !HORA.test(x.hora_salida)) {
    throw new Error("hora_salida debe tener el formato HH:MM (00:00 a 23:59)");
  }
  if (!Array.isArray(x.dias) || x.dias.length === 0) {
    throw new Error("Selecciona al menos un dia de operacion");
  }
  const dias = x.dias.map((d: unknown) => {
    if (typeof d !== "number" || !Number.isInteger(d) || d < 1 || d > 7) {
      throw new Error("Los dias deben ser enteros del 1 (lunes) al 7 (domingo)");
    }
    return d;
  });
  if (new Set(dias).size !== dias.length) {
    throw new Error("Los dias no pueden repetirse");
  }

  if (x.activa !== undefined && typeof x.activa !== "boolean") {
    throw new Error("activa debe ser verdadero o falso");
  }

  return {
    activa: x.activa as boolean | undefined,
    codigo,
    ruta_id: x.ruta_id,
    resolucion_id: x.resolucion_id,
    hora_salida: x.hora_salida,
    dias: [...dias].sort((a, b) => a - b),
  };
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_DIAS_GENERACION = 31;

export interface TarifaTramo {
  origen_orden: number;
  destino_orden: number;
  normal: number;
  vip: number | null;
}

export interface GeneracionValidada {
  frecuencia_id: string;
  bus_id: string;
  desde: string;
  hasta: string;
  minutos_cierre: number;
  fuente_normativa: string;
  tarifas: TarifaTramo[];
}

function fechaReal(texto: unknown): texto is string {
  if (typeof texto !== "string" || !FECHA.test(texto)) return false;
  const d = new Date(`${texto}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === texto;
}

function importe(valor: unknown, nombre: string): number {
  if (typeof valor !== "number" || !Number.isFinite(valor) || valor <= 0 || valor > 1000) {
    throw new Error(`${nombre} debe ser un valor mayor que 0 y hasta 1000`);
  }
  if (Math.round(valor * 100) !== valor * 100) {
    throw new Error(`${nombre} admite hasta 2 decimales`);
  }
  return valor;
}

// hoy: fecha actual en la zona de la cooperativa ("YYYY-MM-DD").
export function validarGeneracion(cuerpo: unknown, hoy: string): GeneracionValidada {
  if (typeof cuerpo !== "object" || cuerpo === null) {
    throw new Error("El cuerpo de la solicitud no es valido");
  }
  const x = cuerpo as Record<string, unknown>;

  if (typeof x.frecuencia_id !== "string" || !UUID.test(x.frecuencia_id)) {
    throw new Error("frecuencia_id debe ser un UUID valido");
  }
  if (typeof x.bus_id !== "string" || !UUID.test(x.bus_id)) {
    throw new Error("bus_id debe ser un UUID valido");
  }
  if (!fechaReal(x.desde) || !fechaReal(x.hasta)) {
    throw new Error("desde y hasta deben ser fechas validas (YYYY-MM-DD)");
  }
  if (x.desde < hoy) {
    throw new Error("No se pueden programar viajes en fechas pasadas");
  }
  if (x.hasta < x.desde) {
    throw new Error("La fecha hasta no puede ser anterior a desde");
  }
  const dias =
    (Date.parse(`${x.hasta}T00:00:00Z`) - Date.parse(`${x.desde}T00:00:00Z`)) / 86400000 + 1;
  if (dias > MAX_DIAS_GENERACION) {
    throw new Error(`Se pueden programar hasta ${MAX_DIAS_GENERACION} dias por vez`);
  }

  const minutos = x.minutos_cierre === undefined ? 60 : x.minutos_cierre;
  if (typeof minutos !== "number" || !Number.isInteger(minutos) || minutos < 0 || minutos > 1440) {
    throw new Error("minutos_cierre debe ser un entero entre 0 y 1440");
  }

  const fuente = typeof x.fuente_normativa === "string" ? x.fuente_normativa.trim() : "";
  if (fuente.length < 3 || fuente.length > 200) {
    throw new Error("La fuente normativa de las tarifas es obligatoria (3 a 200 caracteres)");
  }

  if (!Array.isArray(x.tarifas) || x.tarifas.length === 0) {
    throw new Error("Indica al menos una tarifa por tramo");
  }
  const vistos = new Set<string>();
  const tarifas = x.tarifas.map((t: unknown, i: number): TarifaTramo => {
    if (typeof t !== "object" || t === null) {
      throw new Error(`La tarifa ${i + 1} no es valida`);
    }
    const y = t as Record<string, unknown>;
    const o = y.origen_orden;
    const d = y.destino_orden;
    if (
      typeof o !== "number" || typeof d !== "number" ||
      !Number.isInteger(o) || !Number.isInteger(d) || o < 1 || d <= o
    ) {
      throw new Error(`La tarifa ${i + 1} necesita origen_orden y destino_orden validos`);
    }
    const clave = `${o}-${d}`;
    if (vistos.has(clave)) throw new Error(`El tramo ${o} a ${d} esta repetido`);
    vistos.add(clave);

    return {
      origen_orden: o,
      destino_orden: d,
      normal: importe(y.normal, `La tarifa NORMAL del tramo ${o} a ${d}`),
      vip:
        y.vip === undefined || y.vip === null
          ? null
          : importe(y.vip, `La tarifa VIP del tramo ${o} a ${d}`),
    };
  });

  return {
    frecuencia_id: x.frecuencia_id,
    bus_id: x.bus_id,
    desde: x.desde,
    hasta: x.hasta,
    minutos_cierre: minutos,
    fuente_normativa: fuente,
    tarifas,
  };
}
