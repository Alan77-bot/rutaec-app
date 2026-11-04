import type { Request, Response } from "express";
import { enviarError, enviarExito } from "../../utils/respuestas.js";
import { buscarViajes, listarCiudadesDisponibles } from "./reservas.service.js";
import { obtenerDisponibilidad } from "./reservas.asientos.js";
import { validarBusqueda, validarDisponibilidad } from "./reservas.validaciones.js";

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

export async function obtenerCiudades(req: Request, res: Response): Promise<void> {
  const cooperativa = req.query.cooperativa;
  if (cooperativa !== undefined && (typeof cooperativa !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cooperativa))) {
    enviarError(res, 400, 'La cooperativa seleccionada no es válida', 'PARAMETROS_INVALIDOS');
    return;
  }
  try {
    const ciudades = await listarCiudadesDisponibles(cooperativa);

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

export async function obtenerDisponibilidadViaje(
  req: Request,
  res: Response
): Promise<void> {
  const validacion = validarDisponibilidad(req.query);

  if (!validacion.ok) {
    enviarError(res, 400, validacion.falla.error, validacion.falla.code);
    return;
  }

  try {
    const { viajeId, origen, destino } = validacion.datos;
    const disponibilidad = await obtenerDisponibilidad(viajeId, origen, destino);

    if (!disponibilidad) {
      enviarError(
        res,
        404,
        "El viaje no existe, ya no esta a la venta o no pasa por esas ciudades",
        "NO_ENCONTRADO"
      );
      return;
    }

    enviarExito(res, disponibilidad);
  } catch (error) {
    console.error("Error al consultar la disponibilidad:", error);

    enviarError(
      res,
      500,
      "No se pudo consultar la disponibilidad de asientos",
      "ERROR_INTERNO"
    );
  }
}
