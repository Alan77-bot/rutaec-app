import type { RequestHandler } from "express";
import type { SesionAutenticada } from "./autenticacion.js";

type Rol = SesionAutenticada["rol"];

export function autorizarRoles(
  ...rolesPermitidos: Rol[]
): RequestHandler {
  return (_req, res, next) => {
    const sesion = res.locals.sesion as
      | SesionAutenticada
      | undefined;

    if (!sesion) {
      res.status(401).json({
        error: "Debes iniciar sesión.",
      });
      return;
    }

    if (!rolesPermitidos.includes(sesion.rol)) {
      res.status(403).json({
        error: "No tienes permisos para realizar esta operación.",
      });
      return;
    }

    next();
  };
}