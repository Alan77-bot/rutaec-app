
export interface Cooperativa {
  id: string;
  ruc: string;
  nombre_comercial: string;
  razon_social: string;
  correo: string;
  telefono: string;
  direccion: string;
  sitio_web: string | null;
  activa: boolean;
}

interface RespuestaCooperativas {
  total: number;
  datos: Cooperativa[];
}

export async function obtenerCooperativas(): Promise<Cooperativa[]> {
  const respuesta = await fetch("/api/cooperativas");

  if (!respuesta.ok) {
    throw new Error("No se pudieron consultar las cooperativas");
  }

  const resultado: RespuestaCooperativas = await respuesta.json();

  return resultado.datos;
}

export interface DatosRegistroCooperativa {
  ruc: string;
  razon_social: string;
  nombre_comercial: string;
  correo: string;
  telefono: string;
  direccion: string;
}

export async function registrarCooperativa(
  datos: DatosRegistroCooperativa
): Promise<void> {
  const respuesta = await fetch("/api/cooperativas", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(datos),
  });

  if (!respuesta.ok) {
    const resultado = await respuesta.json().catch(() => null);

    throw new Error(
      resultado?.error || "No se pudo registrar la cooperativa"
    );
  }
}

export interface DatosActualizarCooperativa {
  nombre_comercial: string;
  razon_social: string;
  correo: string;
  telefono: string;
  direccion: string;
  sitio_web: string;
}

export async function actualizarCooperativa(
  id: string,
  datos: DatosActualizarCooperativa
): Promise<void> {
  const respuesta = await fetch(`/api/cooperativas/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(datos),
  });

  if (!respuesta.ok) {
    const resultado = await respuesta.json().catch(() => null);

    throw new Error(
      resultado?.error || "No se pudo actualizar la cooperativa"
    );
  }
}

export async function cambiarEstadoCooperativa(
  id: string,
  activa: boolean
): Promise<void> {
  const respuesta = await fetch(`/api/cooperativas/${id}/estado`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ activa }),
  });

  if (!respuesta.ok) {
    const resultado = await respuesta.json().catch(() => null);

    throw new Error(
      resultado?.error || "No se pudo cambiar el estado de la cooperativa"
    );
  }
}


export async function eliminarCooperativa(
  id: string
): Promise<void> {
  const respuesta = await fetch(`/api/cooperativas/${id}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!respuesta.ok) {
    const resultado = await respuesta.json().catch(() => null);

    throw new Error(
      resultado?.error || "No se pudo eliminar la cooperativa"
    );
  }
}
