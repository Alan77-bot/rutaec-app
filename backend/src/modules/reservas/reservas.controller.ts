import type { Request, Response } from "express";
import { enviarError, enviarExito } from "../../utils/respuestas.js";
import { buscarViajes } from "./reservas.service.js";
import { validarBusqueda } from "./reservas.validaciones.js";

export async function obtenerViajes(req: Request, res: Response): Promise<void> {
  const validacion = validarBusqueda(req.query);

  if (!validacion.ok) {
    enviarError(res, 400, validacion.falla.error, validacion.falla.code);
    return;
  }

  try {
    const viajes = await buscarViajes(validacion.datos);

    enviarExito(res, viajes);
  } catch (error) {
    console.error("Error al buscar viajes:", error);

    enviarError(
      res,
      500,
      "No se pudieron consultar los viajes",
      "ERROR_INTERNO"
    );
  }
}
