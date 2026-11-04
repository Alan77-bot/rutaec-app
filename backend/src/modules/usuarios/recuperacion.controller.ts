import type { Request, Response } from "express";
import {
  solicitarRecuperacion,
  restablecerContrasena,
} from "./recuperacion.service.js";

export async function solicitar(req: Request, res: Response) {
  const resultado = await solicitarRecuperacion(req.body);

  res.status(200).json(resultado);
}

export async function restablecer(req: Request, res: Response) {
  const resultado = await restablecerContrasena(req.body);

  res.clearCookie("rutaec_sesion", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api",
  });

  res.status(200).json(resultado);
}