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
