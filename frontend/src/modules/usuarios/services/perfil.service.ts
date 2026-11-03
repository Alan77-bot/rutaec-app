export interface PerfilUsuario {
  id: string;
  nombres: string;
  apellidos: string;
  telefono: string;
  correo: string;
  tipo_documento: string;
  pais_documento: string;
  numero_documento: string;
}

async function solicitar<T>(ruta: string, method = "GET", datos?: unknown): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`/api/usuarios/perfil${ruta}`, {
      method, credentials: "include",
      headers: datos === undefined ? undefined : { "Content-Type": "application/json" },
      body: datos === undefined ? undefined : JSON.stringify(datos),
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor. Vuelve a intentarlo.");
  }
  const cuerpo = await respuesta.json().catch(() => null);
  if (!respuesta.ok) throw Object.assign(new Error(cuerpo?.error ?? "No se pudo completar la operación."), { estado: respuesta.status });
  return cuerpo as T;
}

export const perfilService = {
  consultar: () => solicitar<{ perfil: PerfilUsuario }>(""),
  actualizar: (datos: Pick<PerfilUsuario, "nombres" | "apellidos" | "telefono">) => solicitar<{ perfil: PerfilUsuario }>("", "PATCH", datos),
  cambiarClave: (datos: { claveActual: string; nuevaClave: string; confirmarClave: string }) => solicitar<{ mensaje: string }>("/clave", "POST", datos),
  solicitarCorreo: (nuevoCorreo: string, claveActual: string) => solicitar<{ mensaje: string; verificacionId: string; venceEn: string }>("/correo", "POST", { nuevoCorreo, claveActual }),
  confirmarCorreo: (verificacionId: string, codigo: string) => solicitar<{ mensaje: string }>("/correo/confirmar", "POST", { verificacionId, codigo }),
};
