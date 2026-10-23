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
