import type { Request, Response } from "express";
import { enviarError, enviarExito } from "../../utils/respuestas.js";
import { buscarViajes, listarCiudadesDisponibles } from "./reservas.service.js";
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

export async function obtenerCiudades(_req: Request, res: Response): Promise<void> {
  try {
    const ciudades = await listarCiudadesDisponibles();

    enviarExito(res, ciudades);
  } catch (error) {
    console.error("Error al listar ciudades:", error);

    enviarError(
      res,
      500,
      "No se pudieron consultar las ciudades",
      "ERROR_INTERNO"
    );
  }
}
