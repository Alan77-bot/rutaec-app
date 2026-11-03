import type { Request, Response } from "express";
import { listarBusesPorCooperativa } from "./buses.service.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function obtenerBuses(
  req: Request,
  res: Response
): Promise<void> {
  const sesion = res.locals.sesion;

  if (!sesion) {
    res.status(401).json({ error: "Debes iniciar sesión" });
    return;
  }

  if (sesion.rol !== "admin" && sesion.rol !== "cooperativa") {
    res.status(403).json({
      error: "No tienes permisos para consultar la flota",
    });
    return;
  }

  const cooperativaId =
    sesion.rol === "admin"
      ? req.query.cooperativaId
      : sesion.coopId;

  if (
    typeof cooperativaId !== "string" ||
    !UUID_REGEX.test(cooperativaId)
  ) {
    res.status(400).json({
      error: "Debes proporcionar una cooperativa válida",
    });
    return;
  }

  try {
    const buses = await listarBusesPorCooperativa(cooperativaId);

    res.status(200).json({
      total: buses.length,
      datos: buses,
    });
  } catch (error) {
    console.error("Error al consultar la flota:", error);

    res.status(500).json({
      error: "No se pudieron consultar los buses",
    });
  }
}
