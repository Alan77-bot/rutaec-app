
const BASE_URL = "/api/gerentes";
const USUARIOS_ADMIN_URL = "/api/administracion/usuarios";

export class ErrorAdministracion extends Error {
  estado: number;

  constructor(mensaje: string, estado: number) {
    super(mensaje);
    this.name = "ErrorAdministracion";
    this.estado = estado;
  }
}

export interface UsuarioDisponible {
  id: string;
  nombres: string;
  apellidos: string;
  correo: string;
  numero_documento: string;
  telefono: string;
  activo: boolean;
  correo_verificado_en: string | null;

  roles_globales: {
    rol: string;
  }[];

  miembros_cooperativa: {
    cooperativa_id: string;
    rol: string;
    activo: boolean;
    cooperativas: {
      nombre_comercial: string;
      activa: boolean;
    };
  }[];
}


export interface UsuarioAdmin extends UsuarioDisponible {
  tipo_documento: string;
  pais_documento: string;
  creado_en: string;
  actualizado_en: string;
}

export interface DatosEditarUsuario {
  nombres: string;
  apellidos: string;
  telefono: string;
}


export interface Gerente {
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

  cooperativas: {
    id: string;
    razon_social: string;
    nombre_comercial: string;
    activa: boolean;
  };
}

export interface DatosNuevoGerente {
  nombres: string;
  apellidos: string;
  correo: string;
  numero_documento: string;
  telefono: string;
  cooperativa_id: string;
  clave: string;
}

export interface DatosAsignacionGerente {
  usuario_id: string;
  cooperativa_id: string;
}

async function solicitar<T>(
  ruta: string,
  metodo = "GET",
  cuerpo?: unknown,
  baseUrl = BASE_URL
): Promise<T> {
  let respuesta: Response;

  try {
    respuesta = await fetch(`${baseUrl}${ruta}`, {
      method: metodo,
      credentials: "include",
      headers: cuerpo === undefined
        ? undefined
        : {
            "Content-Type": "application/json",
          },
      body: cuerpo === undefined
        ? undefined
        : JSON.stringify(cuerpo),
    });
  } catch {
    throw new ErrorAdministracion(
      "No se pudo conectar con el servidor.",
      0
    );
  }

  const datos = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    throw new ErrorAdministracion(
      datos?.error ?? "No se pudo completar la operación.",
      respuesta.status
    );
  }

  return datos as T;
}

export const administracionService = {
  async obtenerGerentes(): Promise<Gerente[]> {
    const respuesta = await solicitar<{
      total: number;
      datos: Gerente[];
    }>("/");

    return respuesta.datos;
  },

  async obtenerUsuariosDisponibles(): Promise<UsuarioDisponible[]> {
    const respuesta = await solicitar<{
      total: number;
      datos: UsuarioDisponible[];
    }>("/usuarios-disponibles");

    return respuesta.datos;
  },

  async crearGerente(datos: DatosNuevoGerente) {
    return solicitar<{
      mensaje: string;
      datos: unknown;
    }>("/", "POST", datos);
  },

  async asignarGerenteExistente(
    datos: DatosAsignacionGerente
  ) {
    return solicitar<{
      mensaje: string;
      datos: unknown;
    }>("/asignar-existente", "POST", datos);
  },

  async cambiarCooperativa(
    usuarioId: string,
    cooperativaId: string
  ) {
    return solicitar<{
      mensaje: string;
      datos: unknown;
    }>(
      `/${encodeURIComponent(usuarioId)}`,
      "PATCH",
      {
        cooperativa_id: cooperativaId,
      }
    );
  },


async cambiarEstado(
  usuarioId: string,
  activo: boolean,
  cooperativaId: string
) {
  return solicitar<{
    mensaje: string;
    datos: unknown;
  }>(
    `/${encodeURIComponent(usuarioId)}/estado`,
    "PATCH",
    {
      activo,
      cooperativa_id: cooperativaId,
    }
  );
},



async listarUsuariosAdmin(): Promise<UsuarioAdmin[]> {
  const respuesta = await solicitar<{
    total: number;
    datos: UsuarioAdmin[];
  }>(
    "/",
    "GET",
    undefined,
    USUARIOS_ADMIN_URL
  );

  return respuesta.datos;
},

async obtenerUsuarioAdmin(
  usuarioId: string
): Promise<UsuarioAdmin> {
  const respuesta = await solicitar<{
    datos: UsuarioAdmin;
  }>(
    `/${encodeURIComponent(usuarioId)}`,
    "GET",
    undefined,
    USUARIOS_ADMIN_URL
  );

  return respuesta.datos;
},

async editarUsuarioAdmin(
  usuarioId: string,
  datos: DatosEditarUsuario
) {
  return solicitar<{
    mensaje: string;
    datos: UsuarioAdmin;
  }>(
    `/${encodeURIComponent(usuarioId)}`,
    "PATCH",
    datos,
    USUARIOS_ADMIN_URL
  );
},

async cambiarEstadoUsuarioAdmin(
  usuarioId: string,
  activo: boolean
) {
  return solicitar<{
    mensaje: string;
    datos: UsuarioAdmin;
  }>(
    `/${encodeURIComponent(usuarioId)}/estado`,
    "PATCH",
    { activo },
    USUARIOS_ADMIN_URL
  );
},

};
