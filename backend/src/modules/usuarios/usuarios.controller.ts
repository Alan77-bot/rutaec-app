import type { CookieOptions, Request, Response } from "express";
import {
  autenticar,
  DURACION_SESION_MS,
  obtenerSesion,
  revocarSesion,
} from "./usuarios.service.js";

const COOKIE_SESION = "rutaec_sesion";

const opcionesCookie: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/api",
};

export async function login(req: Request, res: Response) {
  const { correo, clave } = req.body ?? {};

  const resultado = await autenticar(correo, clave);

  res.cookie(COOKIE_SESION, resultado.token, {
    ...opcionesCookie,
    maxAge: DURACION_SESION_MS,
  });

  res.status(200).json({
    sesion: resultado.sesion,
  });
}

export async function yo(req: Request, res: Response) {
  const sesion = await obtenerSesion(req.cookies?.[COOKIE_SESION]);

  res.status(200).json({ sesion });
}

export async function logout(req: Request, res: Response) {
  await revocarSesion(req.cookies?.[COOKIE_SESION]);

  res.clearCookie(COOKIE_SESION, opcionesCookie);
  res.status(204).end();
}