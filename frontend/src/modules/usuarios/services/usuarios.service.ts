export interface SesionUsuario {
  id: string;
  nombre: string;
  correo: string;
  rol: "admin" | "cooperativa" | "oficinista" | "usuario";
  coopId: string | null;
}

export class ErrorUsuarios extends Error {
  public estado: number;

  constructor(mensaje: string, estado: number) {
    super(mensaje);
    this.name = "ErrorUsuarios";
    this.estado = estado;
  }
}

async function solicitar<T>(
  ruta: string,
  metodo = "GET",
  cuerpo?: unknown
): Promise<T> {
  let respuesta: Response;

  try {
    respuesta = await fetch(`/api/usuarios${ruta}`, {
      method: metodo,
      credentials: "include",
      headers: cuerpo === undefined
        ? undefined
        : { "Content-Type": "application/json" },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    throw new ErrorUsuarios(
      "No se pudo conectar con la API. Comprueba que el backend esté encendido.",
      0
    );
  }

  if (respuesta.status === 204) {
    return undefined as T;
  }

  const datos = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    throw new ErrorUsuarios(
      datos?.error ?? "No se pudo completar la solicitud.",
      respuesta.status
    );
  }

  return datos as T;
}

export interface DatosRegistro {
  nombres: string;
  apellidos: string;
  tipo_documento: string;
  pais_documento: string;
  numero_documento: string;
  telefono: string;
  correo: string;
  clave: string;
}

export interface RespuestaRegistro {
  mensaje: string;
  correo: string;
  verificacionId: string;
  venceEn: string;
}

export const usuariosService = {
  login(correo: string, clave: string) {
    return solicitar<{ sesion: SesionUsuario }>("/login", "POST", {
      correo,
      clave,
    });
  },

  solicitarRecuperacion(correo: string) {
    return solicitar<{ mensaje: string }>(
      "/recuperar-contrasena",
      "POST",
      { correo }
    );
  },

  restablecerContrasena(
    token: string,
    nuevaClave: string,
    confirmarClave: string
  ) {
    return solicitar<{ mensaje: string }>(
      "/restablecer-contrasena",
      "POST",
      {
        token,
        nuevaClave,
        confirmarClave,
      }
    );
  },

  yo() {
    return solicitar<{ sesion: SesionUsuario }>("/yo");
  },

  logout() {
    return solicitar<void>("/logout", "POST", {});
  },

  registrar(datos: DatosRegistro) {
    return solicitar<RespuestaRegistro>("/registro", "POST", datos);
  },

  verificarCorreo(
    verificacionId: string,
    codigo: string,
    clave: string
  ) {
    return solicitar<{ mensaje: string }>("/verificar-correo", "POST", {
      verificacionId,
      codigo,
      clave,
    });
  },

  reenviarCodigo(correo: string, clave: string) {
    return solicitar<RespuestaRegistro>("/reenviar-codigo", "POST", {
      correo,
      clave,
    });
  },
};