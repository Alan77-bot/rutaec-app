export class ErrorHorarios extends Error {
  public estado: number;

  constructor(mensaje: string, estado: number) {
    super(mensaje);
    this.name = "ErrorHorarios";
    this.estado = estado;
  }
}

export interface Frecuencia {
  id: string;
  codigo: string;
  cooperativa_id: string;
  cooperativa: string;
  ruta_id: string;
  ruta: string;
  resolucion_id: string;
  resolucion: string;
  hora_salida: string;
  zona_horaria: string;
  activa: boolean;
  dias: number[];
}

export interface Resolucion {
  id: string;
  cooperativa_id: string;
  numero: string;
  autoridad: string;
  fecha_emision: string;
  vigente_desde: string;
  vigente_hasta: string | null;
}

export interface FrecuenciaEntrada {
  cooperativa_id?: string;
  codigo: string;
  ruta_id: string;
  resolucion_id: string;
  hora_salida: string;
  dias: number[];
  activa?: boolean;
}

interface Lista<T> {
  total: number;
  datos: T[];
}

interface Resultado<T> {
  mensaje: string;
  datos: T;
}

async function solicitar<T>(
  ruta: string,
  metodo = "GET",
  cuerpo?: unknown
): Promise<T> {
  let respuesta: Response;

  try {
    respuesta = await fetch(`/api/horarios${ruta}`, {
      method: metodo,
      credentials: "include",
      headers:
        cuerpo === undefined ? undefined : { "Content-Type": "application/json" },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    throw new ErrorHorarios(
      "No se pudo conectar con la API. Comprueba que el backend esté encendido.",
      0
    );
  }

  const datos = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    throw new ErrorHorarios(
      datos?.error ?? "No se pudo completar la solicitud.",
      respuesta.status
    );
  }

  return datos as T;
}

export const horariosService = {
  async listarFrecuencias(): Promise<Frecuencia[]> {
    const r = await solicitar<Lista<Frecuencia>>("/frecuencias");
    return r.datos;
  },

  async listarResoluciones(cooperativaId?: string): Promise<Resolucion[]> {
    const consulta = cooperativaId
      ? `?cooperativa_id=${encodeURIComponent(cooperativaId)}`
      : "";
    const r = await solicitar<Lista<Resolucion>>(`/resoluciones${consulta}`);
    return r.datos;
  },

  async crearFrecuencia(entrada: FrecuenciaEntrada): Promise<Frecuencia> {
    const r = await solicitar<Resultado<Frecuencia>>("/frecuencias", "POST", entrada);
    return r.datos;
  },

  async actualizarFrecuencia(
    id: string,
    entrada: FrecuenciaEntrada
  ): Promise<Frecuencia> {
    const r = await solicitar<Resultado<Frecuencia>>(
      `/frecuencias/${id}`,
      "PUT",
      entrada
    );
    return r.datos;
  },
};
