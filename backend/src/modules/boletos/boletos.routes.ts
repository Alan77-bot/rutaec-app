import { Router } from "express";
import type { RequestHandler } from "express";
import cookieParser from "cookie-parser";
import { ErrorAutenticacion, obtenerSesion } from "../usuarios/usuarios.service.js";
import {
  detalleBoleto,
  imagenQr,
  misBoletos,
  pdfBoleto,
  verificarBoleto,
} from "./boletos.controller.js";

const router = Router();

// Exige una sesión iniciada. La identidad sale del servidor (cookie de sesión),
// nunca del cuerpo ni de la URL de la petición.
// Cuando se integre el middleware compartido de permisos (#11), se reemplaza por él.
const exigirSesion: RequestHandler = async (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");

  try {
    res.locals.sesion = await obtenerSesion(req.cookies?.rutaec_sesion);
    next();
  } catch (error) {
    if (error instanceof ErrorAutenticacion) {
      res.status(error.estado).json({ error: error.message });
      return;
    }

    console.error("[boletos] No se pudo comprobar la sesión");
    res.status(500).json({ error: "No se pudo comprobar la sesión." });
  }
};

// Las acciones que modifican datos solo se aceptan desde el frontend autorizado (protege la cookie de sesión).
const origenPermitido = new URL(process.env.FRONTEND_URL ?? "http://localhost:5173").origin;

const exigirOrigen: RequestHandler = (req, res, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.get("origin") !== origenPermitido) {
    res.status(403).json({ error: "Origen de la solicitud no permitido." });
    return;
  }
  next();
};

router.use(cookieParser(), exigirOrigen, exigirSesion);

router.get("/mios", misBoletos);
router.post("/verificar", verificarBoleto);
router.get("/:id/qr", imagenQr);
router.get("/:id/pdf", pdfBoleto);
router.get("/:id", detalleBoleto);

export default router;
