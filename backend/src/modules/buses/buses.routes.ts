
import { Router } from "express";
import type {
  Request,
  Response,
  NextFunction,
} from "express";

import { autenticar } from "../../middlewares/autenticacion.js";

import {
  obtenerBuses,
  crearBus,
  obtenerGruposBuses,
  editarBus,
  cambiarEstadoDeBus,
  obtenerComodidades,
} from "./buses.controller.js";

const router = Router();

// ========================================
// ORÍGENES PERMITIDOS
// ========================================

const origenesPermitidos = new Set(
  (process.env.FRONTEND_URL ?? "http://localhost:5173")
    .split(",")
    .map((url) => new URL(url.trim()).origin)
);

// ========================================
// MIDDLEWARE: VALIDAR ORIGEN
// ========================================

function validarOrigen(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const origen = req.get("origin");

  if (!origen || !origenesPermitidos.has(origen)) {
    res.status(403).json({
      error: "Origen de la solicitud no permitido",
    });
    return;
  }

  next();
}

// ========================================
// CONSULTAR BUSES
// GET /api/buses
// ========================================

router.get(
  "/",
  ...autenticar,
  obtenerBuses
);

// ========================================
// CONSULTAR CATÁLOGO DE COMODIDADES
// GET /api/buses/comodidades
// ========================================

router.get(
  "/comodidades",
  ...autenticar,
  obtenerComodidades
);

// ========================================
// CONSULTAR GRUPOS DE BUSES
// GET /api/buses/grupos
// ========================================

router.get(
  "/grupos",
  ...autenticar,
  obtenerGruposBuses
);

// ========================================
// REGISTRAR BUS
// POST /api/buses
// ========================================

router.post(
  "/",
  validarOrigen,
  ...autenticar,
  crearBus
);

// ========================================
// EDITAR BUS
// PATCH /api/buses/:id
// ========================================

router.patch(
  "/:id",
  validarOrigen,
  ...autenticar,
  editarBus
);

// ========================================
// CAMBIAR ESTADO DEL BUS
// PATCH /api/buses/:id/estado
//
// Estados:
// ACTIVO
// INACTIVO
// MANTENIMIENTO
// ========================================

router.patch(
  "/:id/estado",
  validarOrigen,
  ...autenticar,
  cambiarEstadoDeBus
);

export default router;
