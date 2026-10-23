import type { Request, Response } from "express";
import { listarFrecuencias } from "./horarios.service.js";

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
