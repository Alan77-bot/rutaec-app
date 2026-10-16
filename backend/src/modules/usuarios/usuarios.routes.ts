import {
  solicitar,
  restablecer,
} from "./recuperacion.controller.js";

import { Router } from "express";
import type { ErrorRequestHandler } from "express";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import {
  login,
  logout,
  yo,
  registro,
  verificar,
  reenviar,
} from "./usuarios.controller.js";
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

const limitarRegistro = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Demasiados intentos de registro. Inténtalo más tarde.",
  },
});

const limitarVerificacionPorIp = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Demasiados intentos de verificación. Inténtalo más tarde.",
  },
});

const limitarVerificacionPorCodigo = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const id = req.body?.verificacionId;

    if (
      typeof id === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ) {
      return id.toLowerCase();
    }

    return "identificador-invalido";
  },
  message: {
    error: "Alcanzaste el límite de intentos para este código. Solicita uno nuevo.",
  },
});

const limitarReenvio = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Demasiadas solicitudes de reenvío. Inténtalo más tarde.",
  },
});

router.post("/registro", limitarRegistro, registro);

router.post(
  "/verificar-correo",
  limitarVerificacionPorIp,
  limitarVerificacionPorCodigo,
  verificar
);

router.post("/reenviar-codigo", limitarReenvio, reenviar);

router.post("/login", limitarLogin, login);
router.get("/yo", ...autenticar, yo);
router.post("/logout", logout);

const limitarSolicitudRecuperacion = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error:
      "Demasiadas solicitudes de recuperación. Inténtalo en 15 minutos.",
  },
});

const limitarRestablecimiento = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error:
      "Demasiados intentos de restablecimiento. Inténtalo en 15 minutos.",
  },
});

router.post(
  "/recuperar-contrasena",
  limitarSolicitudRecuperacion,
  solicitar
);

router.post(
  "/restablecer-contrasena",
  limitarRestablecimiento,
  restablecer
);

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