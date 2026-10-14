import type { Request, Response } from "express";
import { listarCiudades } from "./rutas.service.js";

export async function obtenerCiudades(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const ciudades = await listarCiudades();
    res.status(200).json({ total: ciudades.length, datos: ciudades });
  } catch (error) {
    console.error("Error al consultar ciudades:", error);
    res.status(500).json({ error: "No se pudieron consultar las ciudades" });
  }
}
