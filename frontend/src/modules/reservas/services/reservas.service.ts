export interface TarifaViaje {
  categoria: "NORMAL" | "VIP";
  importe: number;
  moneda: string;
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
};
