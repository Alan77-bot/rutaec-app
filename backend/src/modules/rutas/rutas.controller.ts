import type { Request, Response } from "express";
import type { SesionAutenticada } from "../../middlewares/autenticacion.js";
import {
  actualizarRuta,
  crearRuta,
  ErrorRutas,
  listarCiudades,
  listarRutas,
  listarTerminales,
  type ActorRutas,
} from "./rutas.service.js";

function actorDesdeSesion(res: Response): ActorRutas {
  const sesion = res.locals.sesion as SesionAutenticada;
  return { rol: sesion.rol, coopId: sesion.coopId ?? null };
}

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

export async function registrarRuta(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const ruta = await crearRuta(req.body, actorDesdeSesion(res));
    res.status(201).json({ mensaje: "Ruta registrada correctamente", datos: ruta });
  } catch (error) {
    if (error instanceof ErrorRutas) {
      res.status(error.estado).json({ error: error.message });
      return;
    }
    console.error("Error al registrar ruta:", error);
    res.status(500).json({ error: "No se pudo registrar la ruta" });
  }
}

export async function editarRuta(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const ruta = await actualizarRuta(
      String(req.params.id),
      req.body,
      actorDesdeSesion(res)
    );
    res.status(200).json({ mensaje: "Ruta actualizada correctamente", datos: ruta });
  } catch (error) {
    if (error instanceof ErrorRutas) {
      res.status(error.estado).json({ error: error.message });
      return;
    }
    console.error("Error al actualizar ruta:", error);
    res.status(500).json({ error: "No se pudo actualizar la ruta" });
  }
}
