export class ErrorRutas extends Error {
  public estado: number;

  constructor(mensaje: string, estado: number) {
    super(mensaje);
    this.name = "ErrorRutas";
    this.estado = estado;
  }
}

export interface Ciudad {
  id: string;
  pais: string;
  provincia: string;
  nombre: string;
}

export interface Terminal {
  id: string;
  ciudad_id: string;
  nombre: string;
  direccion: string;
  latitud: string | null;
  longitud: string | null;
  ciudades: { nombre: string; provincia: string };
}

export interface ParadaRuta {
  orden: number;
  terminal_id: string;
  terminal: string;
  ciudad: string;
  minutos_desde_origen: number;
  permite_subida: boolean;
  permite_bajada: boolean;
}

export interface Ruta {
  id: string;
  cooperativa_id: string;
  cooperativa: string;
  nombre: string;
  version: number;
  activa: boolean;
  origen: string | null;
  destino: string | null;
  paradas: ParadaRuta[];
}

export interface ParadaEntrada {
  terminal_id: string;
  minutos_desde_origen: number;
  permite_subida?: boolean;
  permite_bajada?: boolean;
}

export interface RutaEntrada {
  cooperativa_id: string;
  nombre: string;
  paradas: ParadaEntrada[];
}

export interface CambiosRuta {
  nombre?: string;
  activa?: boolean;
  paradas?: ParadaEntrada[];
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
    respuesta = await fetch(`/api/rutas${ruta}`, {
      method: metodo,
      credentials: "include",
      headers:
        cuerpo === undefined ? undefined : { "Content-Type": "application/json" },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    throw new ErrorRutas(
      "No se pudo conectar con la API. Comprueba que el backend esté encendido.",
      0
    );
  }

  const datos = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    throw new ErrorRutas(
      datos?.error ?? "No se pudo completar la solicitud.",
      respuesta.status
    );
  }

  return datos as T;
}

export const rutasService = {
  async listarCiudades(): Promise<Ciudad[]> {
    const r = await solicitar<Lista<Ciudad>>("/ciudades");
    return r.datos;
  },

  async listarTerminales(): Promise<Terminal[]> {
    const r = await solicitar<Lista<Terminal>>("/terminales");
    return r.datos;
  },

  async listarRutas(): Promise<Ruta[]> {
    const r = await solicitar<Lista<Ruta>>("/");
    return r.datos;
  },

  async crearRuta(entrada: RutaEntrada): Promise<Ruta> {
    const r = await solicitar<Resultado<Ruta>>("/", "POST", entrada);
    return r.datos;
  },

  async actualizarRuta(id: string, cambios: CambiosRuta): Promise<Ruta> {
    const r = await solicitar<Resultado<Ruta>>(`/${id}`, "PUT", cambios);
    return r.datos;
  },
};
