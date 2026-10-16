import type { Request, Response } from "express";
import { buscarViajes } from "./reservas.service.js";
import { validarBusqueda } from "./reservas.validaciones.js";

export async function obtenerViajes(req: Request, res: Response): Promise<void> {
  const validacion = validarBusqueda(req.query);

  if (!validacion.ok) {
    res.status(400).json(validacion.falla);
    return;
  }

  try {
    const viajes = await buscarViajes(validacion.datos);

    res.status(200).json({
      data: viajes,
      message: "Operacion correcta",
    });
  } catch (error) {
    console.error("Error al buscar viajes:", error);

    res.status(500).json({
      error: "No se pudieron consultar los viajes",
      code: "ERROR_INTERNO",
    });
  }
}
