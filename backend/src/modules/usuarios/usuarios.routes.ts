import { Router } from "express";
import type { ErrorRequestHandler } from "express";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import { login, logout, yo } from "./usuarios.controller.js";
import { ErrorAutenticacion } from "./usuarios.service.js";
import { autenticar } from "../../middlewares/autenticacion.js";

const router = Router();

const origenPermitido = new URL(
  process.env.FRONTEND_URL ?? "http://localhost:5173"
).origin;

router.use(cookieParser());

router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

// Los cambios de sesión solo se aceptan desde el frontend autorizado.
router.use((req, res, next) => {
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    req.get("origin") !== origenPermitido
  ) {
    res.status(403).json({
      error: "Origen de la solicitud no permitido.",
    });
    return;
  }

  next();
});

const limitarLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    error: "Demasiados intentos. Inténtalo nuevamente en 15 minutos.",
  },
});

router.post("/login", limitarLogin, login);
router.get("/yo", ...autenticar, yo);
router.post("/logout", logout);

const manejarError: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ErrorAutenticacion) {
    res.status(error.estado).json({
      error: error.message,
    });
    return;
  }

  console.error("[usuarios] Error interno en autenticación");

  res.status(500).json({
    error: "No se pudo completar la operación. Inténtalo nuevamente.",
  });
};

router.use(manejarError);

export default router;