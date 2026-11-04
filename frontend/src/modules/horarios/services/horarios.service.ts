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
  estado: "BORRADOR" | "PUBLICADO" | "CERRADO" | "CANCELADO";
  cierre_ventas: string;
  motivo_cancelacion: string | null;
  asientos: number;
  vendidos: number;
  reservados: number;
}

export interface TarifaTramoEntrada {
  origen_orden: number;
  destino_orden: number;
  normal: number;
  vip: number | null;
}

export interface ProgramacionEntrada {
  frecuencia_id: string;
  bus_id: string;
  desde: string;
  hasta: string;
  minutos_cierre: number;
  fuente_normativa: string;
  tarifas: TarifaTramoEntrada[];
}

export interface ResultadoProgramacion {
  creados: { id: string; fecha: string; salida: string; llegada: string; asientos: number }[];
  omitidos: { fecha: string; motivo: string }[];
}

export interface FiltroViajes {
  desde?: string;
  hasta?: string;
  cooperativa_id?: string;
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

  async listarBuses(cooperativaId?: string): Promise<BusProgramable[]> {
    const consulta = cooperativaId
      ? `?cooperativa_id=${encodeURIComponent(cooperativaId)}`
      : "";
    const r = await solicitar<Lista<BusProgramable>>(`/buses${consulta}`);
    return r.datos;
  },

  async listarViajes(filtro: FiltroViajes = {}): Promise<ViajeProgramado[]> {
    const parametros = new URLSearchParams();
    for (const [clave, valor] of Object.entries(filtro)) {
      if (valor) parametros.set(clave, valor);
    }
    const consulta = parametros.toString();
    const r = await solicitar<Lista<ViajeProgramado>>(
      `/viajes${consulta ? `?${consulta}` : ""}`
    );
    return r.datos;
  },

  async programarViajes(entrada: ProgramacionEntrada): Promise<ResultadoProgramacion> {
    const r = await solicitar<Resultado<ResultadoProgramacion>>(
      "/viajes/programar",
      "POST",
      entrada
    );
    return r.datos;
  },

  async cancelarViaje(id: string, motivo: string): Promise<void> {
    await solicitar<Resultado<unknown>>(`/viajes/${id}/cancelar`, "PATCH", { motivo });
  },

  async cambiarCierre(id: string, minutosCierre: number): Promise<void> {
    await solicitar<Resultado<unknown>>(`/viajes/${id}/cierre`, "PATCH", {
      minutos_cierre: minutosCierre,
    });
  },
};
