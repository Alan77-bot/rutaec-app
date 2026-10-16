import type { RequestHandler } from "express";
import type { SesionAutenticada } from "./autenticacion.js";

export function autorizarCooperativa(
  nombreParametro = "coopId"
): RequestHandler {
  return (req, res, next) => {
    const sesion = res.locals.sesion as
      | SesionAutenticada
      | undefined;

    if (!sesion) {
      res.status(401).json({
        error: "Debes iniciar sesión.",
      });
      return;
    }

    const cooperativaId = req.params[nombreParametro];

    if (
      typeof cooperativaId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        cooperativaId
      )
    ) {
      res.status(400).json({
        error: "El identificador de la cooperativa no es válido.",
      });
      return;
    }

    if (sesion.rol === "admin") {
      next();
      return;
    }

    const esPersonal =
      sesion.rol === "cooperativa" ||
      sesion.rol === "oficinista";

    if (
      !esPersonal ||
      !sesion.coopId ||
      sesion.coopId.toLowerCase() !== cooperativaId.toLowerCase()
    ) {
      res.status(403).json({
        error: "No tienes acceso a esta cooperativa.",
      });
      return;
    }

    next();
  };
}