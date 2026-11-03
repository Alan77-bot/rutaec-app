import type { Request, Response } from "express";
import type { SesionAutenticada } from "../../middlewares/autenticacion.js";
import { listarPagos, listarPagosPendientes } from "./pagos.service.js";

function sesionDe(res: Response): SesionAutenticada {
  return res.locals.sesion as SesionAutenticada;
}

export async function obtenerPagos(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const pagos = await listarPagos(sesionDe(res));
    res.status(200).json({ total: pagos.length, datos: pagos });
  } catch (error) {
    console.error("Error al consultar pagos:", error);
    res.status(500).json({ error: "No se pudieron consultar los pagos" });
  }
}

export async function obtenerPagosPendientes(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const pagos = await listarPagosPendientes(sesionDe(res));
    res.status(200).json({ total: pagos.length, datos: pagos });
  } catch (error) {
    console.error("Error al consultar pagos pendientes:", error);
    res
      .status(500)
      .json({ error: "No se pudieron consultar los pagos pendientes" });
  }
}
