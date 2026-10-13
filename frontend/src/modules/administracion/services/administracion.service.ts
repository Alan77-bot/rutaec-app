export interface ResumenAdministracion {
  totalCooperativas: number;
  totalBuses: number;
  totalUsuarios: number;
}

interface RespuestaResumenAdministracion {
  data: ResumenAdministracion;
  message: string;
}

export async function obtenerResumenAdministracion(): Promise<ResumenAdministracion> {
  const respuesta = await fetch("/api/administracion/resumen");

  if (!respuesta.ok) {
    throw new Error("No se pudo obtener el resumen administrativo");
  }

  const resultado: RespuestaResumenAdministracion =
    await respuesta.json();

  return resultado.data;
}