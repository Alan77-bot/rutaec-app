export interface TarifaViaje {
  categoria: "NORMAL" | "VIP";
  importe: number;
  moneda: string;
}

export interface ParadaApi {
  orden: number;
  terminal: string;
  llegada: string;
  salida: string;
}

export interface ViajeApi {
  viaje_id: string;
  origen_orden: number;
  destino_orden: number;
  origen_terminal: string;
  destino_terminal: string;
  salida: string;
  llegada: string;
  cierre_ventas: string;
  cupos_disponibles: number;
  cooperativa: {
    id: string;
    nombre: string;
    color_primario: string;
    color_secundario: string;
  };
  bus: {
    id: string;
    numero_unidad: string;
    placa: string;
    pisos: number;
    capacidad: number;
    imagen_url: string | null;
    marca_chasis: string;
    marca_carroceria: string;
  };
  tarifas: TarifaViaje[];
  paradas: ParadaApi[];
}

export type EstadoAsiento = "LIBRE" | "OCUPADO" | "RETENIDO" | "NO_VENDIBLE";

export interface AsientoApi {
  id: string;
  numero: string;
  piso: number;
  fila: number;
  columna: number;
  categoria: "NORMAL" | "VIP";
  accesible: boolean;
  preferencial: boolean;
  estado: EstadoAsiento;
  precio: number | null;
}

export interface ParadaViajeApi {
  orden: number;
  terminal: string;
  ciudad: string;
  llegada: string;
  salida: string;
  permite_subida: boolean;
  permite_bajada: boolean;
}

export interface ResumenAsientosApi {
  total: number;
  libres: number;
  ocupados: number;
  retenidos: number;
  no_vendibles: number;
}

export interface DisponibilidadApi {
  viaje: ViajeApi;
  // Pueden faltar si el backend es una version anterior a estos campos.
  recorrido?: ParadaViajeApi[];
  resumen?: ResumenAsientosApi;
  asientos: AsientoApi[];
}

export interface ParametrosDisponibilidad {
  viajeId: string;
  origen: string;
  destino: string;
}

export interface ParametrosBusqueda {
  origen: string;
  destino: string;
  fecha: string;
}

export interface CiudadDisponible {
  nombre: string;
  provincia: string;
}

export class ErrorReservas extends Error {
  public estado: number;
  public code: string | null;

  constructor(mensaje: string, estado: number, code: string | null = null) {
    super(mensaje);
    this.name = "ErrorReservas";
    this.estado = estado;
    this.code = code;
  }
}

async function solicitar<T>(ruta: string, signal?: AbortSignal): Promise<T> {
  let respuesta: Response;

  try {
    respuesta = await fetch(`/api/reservas${ruta}`, {
      credentials: "include",
      signal,
    });
  } catch (error) {
    // Una busqueda cancelada no es un fallo de conexion: la pantalla la ignora.
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    throw new ErrorReservas(
      "No se pudo conectar con la API. Comprueba que el backend esté encendido.",
      0
    );
  }

  const datos = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    throw new ErrorReservas(
      datos?.error ?? "No se pudo completar la solicitud.",
      respuesta.status,
      datos?.code ?? null
    );
  }

  return datos as T;
}

export const reservasService = {
  async buscarViajes(
    { origen, destino, fecha }: ParametrosBusqueda,
    signal?: AbortSignal
  ): Promise<ViajeApi[]> {
    const consulta = new URLSearchParams({ origen, destino, fecha });
    const respuesta = await solicitar<{ data: ViajeApi[] }>(
      `/viajes?${consulta.toString()}`,
      signal
    );

    return respuesta.data;
  },

  async listarCiudades(signal?: AbortSignal): Promise<CiudadDisponible[]> {
    const respuesta = await solicitar<{ data: CiudadDisponible[] }>(
      "/ciudades",
      signal
    );

    return respuesta.data;
  },

  async obtenerDisponibilidad(
    { viajeId, origen, destino }: ParametrosDisponibilidad,
    signal?: AbortSignal
  ): Promise<DisponibilidadApi> {
    const consulta = new URLSearchParams({ viajeId, origen, destino });
    const respuesta = await solicitar<{ data: DisponibilidadApi }>(
      `/disponibilidad?${consulta.toString()}`,
      signal
    );

    return respuesta.data;
  },
};
