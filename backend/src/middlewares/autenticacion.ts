import type { RequestHandler } from "express";
import cookieParser from "cookie-parser";
import {
  ErrorAutenticacion,
  obtenerSesion,
} from "../modules/usuarios/usuarios.service.js";

export type SesionAutenticada = Awaited<
  ReturnType<typeof obtenerSesion>
>;

const comprobarSesion: RequestHandler = async (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");

  // La identidad se obtiene del servidor, nunca del cuerpo de la petición.
  delete res.locals.sesion;

  try {
    const sesion = await obtenerSesion(
      req.cookies?.rutaec_sesion
    );

    res.locals.sesion = sesion;
    next();
  } catch (error) {
    if (error instanceof ErrorAutenticacion) {
      res.status(error.estado).json({
        error: error.message,
      });
      return;
    }

    console.error("[autenticacion] No se pudo consultar la sesión");

    res.status(500).json({
      error: "No se pudo comprobar la sesión. Inténtalo nuevamente.",
    });
  }
};

export const autenticar: RequestHandler[] = [
  cookieParser(),
  comprobarSesion,
];
