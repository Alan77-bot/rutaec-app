import type { Request, Response } from "express";
import {
  obtenerGerentes,
  obtenerUsuariosDisponibles,
  registrarGerente,
  asignarGerenteExistente,
  actualizarGerente,
  actualizarEstadoGerente,
} from "./gerentes.service.js";

function responderError(res: Response, error: unknown): void {
  if (
    error !== null &&
    typeof error === "object" &&
    "estado" in error &&
    typeof error.estado === "number" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    res.status(error.estado).json({ error: error.message });
    return;
  }

  console.error("[gerentes] Error inesperado:", error);

  res.status(500).json({
    error: "No se pudo completar la operación.",
  });
}

export async function listarGerentes(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const gerentes = await obtenerGerentes();

    res.status(200).json({
      total: gerentes.length,
      datos: gerentes,
    });
  } catch (error) {
    responderError(res, error);
  }
}

export async function crearGerente(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const gerente = await registrarGerente(req.body);

    res.status(201).json({
      mensaje: "Gerente registrado correctamente.",
      datos: gerente,
    });
  } catch (error) {
    responderError(res, error);
  }
}

export async function editarGerente(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const gerente = await actualizarGerente(
      String(req.params.id),
      req.body
    );

    res.status(200).json({
      mensaje: "Gerente actualizado correctamente.",
      datos: gerente,
    });
  } catch (error) {
    responderError(res, error);
  }
}

export async function cambiarEstadoGerente(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const gerente = await actualizarEstadoGerente(
      String(req.params.id),
      req.body
    );

    res.status(200).json({
      mensaje: "Estado del gerente actualizado correctamente.",
      datos: gerente,
    });
  } catch (error) {
    responderError(res, error);
  }
}

export async function listarUsuariosDisponibles(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const usuarios = await obtenerUsuariosDisponibles();

    res.status(200).json({
      total: usuarios.length,
      datos: usuarios,
    });
  } catch (error) {
    responderError(res, error);
  }
}
export async function asignarGerente(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const asignacion = await asignarGerenteExistente(req.body);

    res.status(201).json({
      mensaje: "Usuario asignado como gerente correctamente.",
      datos: asignacion,
    });
  } catch (error) {
    responderError(res, error);
  }
}