import type { Request, Response } from "express";
import { listarPagos } from "./pagos.service.js";

export async function obtenerPagos(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const pagos = await listarPagos();
    res.status(200).json({ total: pagos.length, datos: pagos });
  } catch (error) {
    console.error("Error al consultar pagos:", error);
    res.status(500).json({ error: "No se pudieron consultar los pagos" });
  }
}
