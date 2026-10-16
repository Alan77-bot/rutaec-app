import {
  verificarCorreo,
  reenviarCodigo,
} from "./verificacion.service.js";
import { registrarUsuario } from "./registro.service.js";
import type { CookieOptions, Request, Response } from "express";
import {
  autenticar,
  DURACION_SESION_MS,
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

export function yo(_req: Request, res: Response) {
  res.status(200).json({
    sesion: res.locals.sesion,
  });
}

export async function logout(req: Request, res: Response) {
  await revocarSesion(req.cookies?.[COOKIE_SESION]);

  res.clearCookie(COOKIE_SESION, opcionesCookie);
  res.status(204).end();
}
export async function registro(req: Request, res: Response) {
  const resultado = await registrarUsuario(req.body);

  res.status(201).json(resultado);
}
export async function verificar(req: Request, res: Response) {
  const resultado = await verificarCorreo(req.body);

  res.status(200).json(resultado);
}

export async function reenviar(req: Request, res: Response) {
  const resultado = await reenviarCodigo(req.body);

  res.status(200).json(resultado);
}