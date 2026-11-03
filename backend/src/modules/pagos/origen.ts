import type { RequestHandler } from "express";

const origenPermitido = new URL(
  process.env.FRONTEND_URL ?? "http://localhost:5173"
).origin;

export const exigirOrigen: RequestHandler = (req, res, next) => {
  if (req.get("origin") !== origenPermitido) {
    res.status(403).json({ error: "Origen de la solicitud no permitido." });
    return;
  }
  next();
};
