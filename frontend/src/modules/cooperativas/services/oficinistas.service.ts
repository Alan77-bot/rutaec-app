
const BASE_URL = "/api/oficinistas";

export interface Oficinista {
  usuario_id: string;
  cooperativa_id: string;
  activo: boolean;
  asignado_en: string;
  usuarios: {
    id: string;
    nombres: string;
    apellidos: string;
    correo: string;
    telefono: string;
    activo: boolean;
    correo_verificado_en: string | null;
  };
}

export interface UsuarioDisponibleOficinista {
  id: string;
  nombres: string;
  apellidos: string;
  correo: string;
  numero_documento: string;
}

export interface PaginacionOficinistas {
  pagina: number;
  limite: number;
  total: number;
  totalPaginas: number;
}

export interface ResultadoUsuariosDisponibles {
  datos: UsuarioDisponibleOficinista[];
  paginacion: PaginacionOficinistas;
}

export interface DatosNuevoOficinista {
  nombres: string;
  apellidos: string;
  correo: string;
  numero_documento: string;
  telefono: string;
  clave: string;
}

export interface NuevoOficinistaRegistrado {
  id: string;
  nombres: string;
  apellidos: string;
  correo: string;
  cooperativa_id: string;
  correo_verificado: boolean;
  verificacionId: string;
  venceEn: string;
}

async function solicitar<T>(
  ruta: string,
  metodo = "GET",
  cuerpo?: unknown
): Promise<T> {
  let respuesta: Response;

  try {
    respuesta = await fetch(`${BASE_URL}${ruta}`, {
      method: metodo,
      credentials: "include",
      headers:
        cuerpo === undefined
          ? undefined
          : { "Content-Type": "application/json" },
      body:
        cuerpo === undefined
          ? undefined
          : JSON.stringify(cuerpo),
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor.");
  }

  const datos = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    throw new Error(
      datos?.error ?? "No se pudo completar la operación."
    );
  }

  return datos as T;
}

export const oficinistasService = {
  async listar(): Promise<Oficinista[]> {
    const respuesta = await solicitar<{ datos: Oficinista[] }>("/");
    return respuesta.datos;
  },
    async listarUsuariosDisponibles(
    buscar = "",
    pagina = 1,
    limite = 10
  ): Promise<ResultadoUsuariosDisponibles> {
    const parametros = new URLSearchParams({
      buscar: buscar.trim(),
      pagina: String(pagina),
      limite: String(limite),
    });

    return solicitar<ResultadoUsuariosDisponibles>(
      `/usuarios-disponibles?${parametros.toString()}`
    );
  },

  async asignar(usuarioId: string) {
    return solicitar(
      "/asignar-existente",
      "POST",
      { usuario_id: usuarioId }
    );
  },

    async registrarNuevo(
    datos: DatosNuevoOficinista
  ): Promise<NuevoOficinistaRegistrado> {
    const respuesta = await solicitar<{
      datos: NuevoOficinistaRegistrado;
    }>("/crear", "POST", datos);

    return respuesta.datos;
  },

  async cambiarEstado(usuarioId: string, activo: boolean) {
    return solicitar(
      `/${encodeURIComponent(usuarioId)}/estado`,
      "PATCH",
      { activo }
    );
  },
};


