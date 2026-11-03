import { Router } from "express";
import { autenticar } from "../../middlewares/autenticacion.js";
import {
  obtenerBuses,
  crearBus,
  obtenerGruposBuses,
  editarBus,
  cambiarEstadoDeBus,
} from "./buses.controller.js";

const router = Router();

const origenesPermitidos = new Set(
  (process.env.FRONTEND_URL ?? "http://localhost:5173")
    .split(",")
    .map((url) => new URL(url.trim()).origin)
);

router.get("/", ...autenticar, obtenerBuses);

router.get("/grupos", ...autenticar, obtenerGruposBuses);

router.post(
  "/",
  (req, res, next) => {
    const origen = req.get("origin");

    if (!origen || !origenesPermitidos.has(origen)) {
      res.status(403).json({
        error: "Origen de la solicitud no permitido",
      });
      return;
    }

    next();
  },
  ...autenticar,
  crearBus
);


router.patch(
  "/:id",
  (req, res, next) => {
    const origen = req.get("origin");

    if (!origen || !origenesPermitidos.has(origen)) {
      res.status(403).json({
        error: "Origen de la solicitud no permitido",
      });
      return;
    }

    next();
  },
  ...autenticar,
  editarBus
);



router.patch(
  "/:id/estado",
  (req, res, next) => {
    const origen = req.get("origin");

    if (!origen || !origenesPermitidos.has(origen)) {
      res.status(403).json({
        error: "Origen de la solicitud no permitido",
      });
      return;
    }

    next();
  },
  ...autenticar,
  cambiarEstadoDeBus
);

export default router;
