import type { Request, Response } from "express";
import type { SesionAutenticada } from "../../middlewares/autenticacion.js";
import {
  crearFrecuencia,
  ErrorHorarios,
  listarFrecuencias,
  listarResoluciones,
} from "./horarios.service.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function obtenerFrecuencias(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const frecuencias = await listarFrecuencias();
    res.status(200).json({ total: frecuencias.length, datos: frecuencias });
  } catch (error) {
    console.error("Error al consultar frecuencias:", error);
    res.status(500).json({ error: "No se pudieron consultar las frecuencias" });
  }
}

export async function obtenerResoluciones(
  req: Request,
  res: Response
): Promise<void> {
  const sesion = res.locals.sesion as SesionAutenticada;
  let cooperativaId: string | undefined;

  if (sesion.rol === "cooperativa") {
    if (!sesion.coopId) {
      res.status(403).json({ error: "Tu cuenta no esta asociada a ninguna cooperativa" });
      return;
    }
    cooperativaId = sesion.coopId;
  } else if (req.query.cooperativa_id !== undefined) {
    const indicada = String(req.query.cooperativa_id);
    if (!UUID.test(indicada)) {
      res.status(400).json({ error: "cooperativa_id debe ser un UUID valido" });
      return;
    }
    cooperativaId = indicada;
  }

  try {
    const resoluciones = await listarResoluciones(cooperativaId);
    res.status(200).json({ total: resoluciones.length, datos: resoluciones });
  } catch (error) {
    console.error("Error al consultar resoluciones:", error);
    res.status(500).json({ error: "No se pudieron consultar las resoluciones" });
  }
}

export async function registrarFrecuencia(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const frecuencia = await crearFrecuencia(req.body);
    res
      .status(201)
      .json({ mensaje: "Frecuencia registrada correctamente", datos: frecuencia });
  } catch (error) {
    if (error instanceof ErrorHorarios) {
      res.status(error.estado).json({ error: error.message });
      return;
    }
    console.error("Error al registrar frecuencia:", error);
    res.status(500).json({ error: "No se pudo registrar la frecuencia" });
  }
}
