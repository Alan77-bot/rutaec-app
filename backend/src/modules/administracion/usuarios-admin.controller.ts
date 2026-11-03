
import type { Request, Response } from "express";
import {
  listarUsuariosAdmin,
  obtenerUsuarioAdmin,
  editarUsuarioAdmin,
  cambiarEstadoUsuarioAdmin,
} from "./usuarios-admin.service.js";
import { ErrorAutenticacion } from "../usuarios/usuarios.service.js";
import type { SesionAutenticada } from "../../middlewares/autenticacion.js";

function responderError(res: Response, error: unknown): void {
  if (error instanceof ErrorAutenticacion) {
    res.status(error.estado).json({
      error: error.message,
    });
    return;
  }

  console.error("[usuarios-admin]", error);

  res.status(500).json({
    error: "No se pudo completar la operación.",
  });
}

export async function listarUsuarios(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const usuarios = await listarUsuariosAdmin();

    res.status(200).json({
      total: usuarios.length,
      datos: usuarios,
    });
  } catch (error) {
    responderError(res, error);
  }
}

export async function obtenerUsuario(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const usuario = await obtenerUsuarioAdmin(
      String(req.params.id)
    );

    res.status(200).json({
      datos: usuario,
    });
  } catch (error) {
    responderError(res, error);
  }
}

export async function editarUsuario(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const usuario = await editarUsuarioAdmin(
      String(req.params.id),
      req.body
    );

    res.status(200).json({
      mensaje: "Usuario actualizado correctamente.",
      datos: usuario,
    });
  } catch (error) {
    responderError(res, error);
  }
}

export async function cambiarEstadoUsuario(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const sesion = res.locals.sesion as
      | SesionAutenticada
      | undefined;

    if (!sesion || sesion.rol !== "admin") {
      res.status(403).json({
        error: "No tienes permisos para esta operación.",
      });
      return;
    }

    const usuario = await cambiarEstadoUsuarioAdmin(
      String(req.params.id),
      req.body,
      sesion.id
    );

    res.status(200).json({
      mensaje: "Estado del usuario actualizado correctamente.",
      datos: usuario,
    });
  } catch (error) {
    responderError(res, error);
  }
}
