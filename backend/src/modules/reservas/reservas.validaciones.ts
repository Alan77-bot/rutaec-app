import type { BusquedaViajes } from "./reservas.service.js";

export type ErrorValidacion = {
  error: string;
  code: "PARAMETROS_INVALIDOS" | "FECHA_INVALIDA" | "FECHA_PASADA";
};

export type ResultadoValidacion =
  | { ok: true; datos: BusquedaViajes }
  | { ok: false; falla: ErrorValidacion };

const MAX_LONGITUD_CIUDAD = 80;
const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const ZONA_HORARIA = "America/Guayaquil";

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

function esFechaReal(fecha: string): boolean {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const f = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    f.getUTCFullYear() === anio &&
    f.getUTCMonth() === mes - 1 &&
    f.getUTCDate() === dia
  );
}

function hoyEcuador(): string {
  // en-CA entrega el formato AAAA-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_HORARIA }).format(
    new Date()
  );
}

export function validarBusqueda(query: Record<string, unknown>): ResultadoValidacion {
  const origen = texto(query.origen);
  const destino = texto(query.destino);
  const fecha = texto(query.fecha);

  if (!origen || !destino || !fecha) {
    return {
      ok: false,
      falla: {
        error: "Los parametros origen, destino y fecha son obligatorios",
        code: "PARAMETROS_INVALIDOS",
      },
    };
  }

  if (origen.length > MAX_LONGITUD_CIUDAD || destino.length > MAX_LONGITUD_CIUDAD) {
    return {
      ok: false,
      falla: {
        error: `Origen y destino admiten hasta ${MAX_LONGITUD_CIUDAD} caracteres`,
        code: "PARAMETROS_INVALIDOS",
      },
    };
  }

  if (origen.toLowerCase() === destino.toLowerCase()) {
    return {
      ok: false,
      falla: {
        error: "El origen y el destino deben ser distintos",
        code: "PARAMETROS_INVALIDOS",
      },
    };
  }

  if (!FORMATO_FECHA.test(fecha) || !esFechaReal(fecha)) {
    return {
      ok: false,
      falla: {
        error: "La fecha debe tener el formato AAAA-MM-DD y ser valida",
        code: "FECHA_INVALIDA",
      },
    };
  }

  if (fecha < hoyEcuador()) {
    return {
      ok: false,
      falla: {
        error: "No se pueden buscar viajes en fechas pasadas",
        code: "FECHA_PASADA",
      },
    };
  }

  return { ok: true, datos: { origen, destino, fecha } };
}
