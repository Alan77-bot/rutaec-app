
import type { Request, Response } from "express";
import { obtenerResumenAdministracion } from "./administracion.service.js";

export async function consultarResumenAdministracion(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const resumen = await obtenerResumenAdministracion();

    res.status(200).json({
      data: resumen,
      message: "Resumen administrativo obtenido correctamente",
    });
  } catch (error) {
    console.error("Error al obtener el resumen administrativo:", error);

    res.status(500).json({
      error: "No se pudo obtener el resumen administrativo",
    });
  }
}
