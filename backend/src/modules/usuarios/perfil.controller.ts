import type { Request, Response } from "express";
import { actualizarPerfil, cambiarClavePerfil, confirmarCorreoPerfil, obtenerPerfil, solicitarCorreoPerfil } from "./perfil.service.js";

function limpiarCookie(res: Response) {
  res.clearCookie("rutaec_sesion", {
    path: "/api", httpOnly: true, sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function consultar(_req: Request, res: Response) {
  res.json({ perfil: await obtenerPerfil(res.locals.sesion.id) });
}
export async function guardar(req: Request, res: Response) {
  res.json({ perfil: await actualizarPerfil(res.locals.sesion.id, req.cookies?.rutaec_sesion, req.body) });
}
export async function cambiarClave(req: Request, res: Response) {
  const resultado = await cambiarClavePerfil(res.locals.sesion.id, req.cookies?.rutaec_sesion, req.body);
  limpiarCookie(res);
  res.json(resultado);
}
export async function solicitarCorreo(req: Request, res: Response) {
  res.json(await solicitarCorreoPerfil(res.locals.sesion.id, req.cookies?.rutaec_sesion, req.body));
}
export async function confirmarCorreo(req: Request, res: Response) {
  const resultado = await confirmarCorreoPerfil(res.locals.sesion.id, req.cookies?.rutaec_sesion, req.body);
  limpiarCookie(res);
  res.json(resultado);
}
