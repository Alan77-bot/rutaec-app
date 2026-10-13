
import type { Request, Response } from "express";
import { listarCooperativas } from "./cooperativas.service.js";

export async function obtenerCooperativas(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const cooperativas = await listarCooperativas();

    res.status(200).json({
      total: cooperativas.length,
      datos: cooperativas,
    });
  } catch (error) {
    console.error("Error al consultar cooperativas:", error);

    res.status(500).json({
      error: "No se pudieron consultar las cooperativas",
    });
  }
}
