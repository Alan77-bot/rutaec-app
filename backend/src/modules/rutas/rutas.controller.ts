import type { Request, Response } from "express";
import { listarCiudades, listarRutas, listarTerminales } from "./rutas.service.js";

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

export async function obtenerTerminales(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const terminales = await listarTerminales();
    res.status(200).json({ total: terminales.length, datos: terminales });
  } catch (error) {
    console.error("Error al consultar terminales:", error);
    res.status(500).json({ error: "No se pudieron consultar las terminales" });
  }
}

export async function obtenerRutas(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const rutas = await listarRutas();
    res.status(200).json({ total: rutas.length, datos: rutas });
  } catch (error) {
    console.error("Error al consultar rutas:", error);
    res.status(500).json({ error: "No se pudieron consultar las rutas" });
  }
}
