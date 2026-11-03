
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

  async asignar(usuarioId: string) {
    return solicitar(
      "/asignar-existente",
      "POST",
      { usuario_id: usuarioId }
    );
  },

  async cambiarEstado(usuarioId: string, activo: boolean) {
    return solicitar(
      `/${encodeURIComponent(usuarioId)}/estado`,
      "PATCH",
      { activo }
    );
  },
};
