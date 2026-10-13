
import type { Request, Response } from "express";
import {
  listarCooperativas,
  registrarCooperativa,
} from "./cooperativas.service.js";

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



export async function crearCooperativa(
  req: Request,
  res: Response
): Promise<void> {
  const campos = [
    "ruc",
    "razon_social",
    "nombre_comercial",
    "correo",
    "telefono",
    "direccion",
  ] as const;

  const cuerpo = req.body;

  if (
    !cuerpo ||
    typeof cuerpo !== "object" ||
    Array.isArray(cuerpo)
  ) {
    res.status(400).json({
      error: "Debes proporcionar los datos de la cooperativa",
    });
    return;
  }

  for (const campo of campos) {
    if (
      typeof cuerpo[campo] !== "string" ||
      cuerpo[campo].trim() === ""
    ) {
      res.status(400).json({
        error: `El campo ${campo} es obligatorio`,
      });
      return;
    }
  }

  if (!/^\d{13}$/.test(cuerpo.ruc.trim())) {
    res.status(400).json({
      error: "El RUC debe contener exactamente 13 dígitos",
    });
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cuerpo.correo.trim())) {
    res.status(400).json({
      error: "El correo electrónico no es válido",
    });
    return;
  }

  try {
    const cooperativa = await registrarCooperativa(cuerpo);

    res.status(201).json({
      mensaje: "Cooperativa registrada correctamente",
      datos: cooperativa,
    });
  } catch (error) {
    const codigo =
      error !== null &&
      typeof error === "object" &&
      "code" in error
        ? error.code
        : null;

    if (codigo === "P2002") {
      res.status(409).json({
        error: "Ya existe una cooperativa con ese RUC",
      });
      return;
    }

    console.error("Error al registrar cooperativa:", error);

    res.status(500).json({
      error: "No se pudo registrar la cooperativa",
    });
  }
}
