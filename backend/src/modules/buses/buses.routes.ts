import { Router } from "express";
import { autenticar } from "../../middlewares/autenticacion.js";
import { obtenerBuses, crearBus, obtenerGruposBuses } from "./buses.controller.js";

const router = Router();

const origenPermitido = new URL(
  process.env.FRONTEND_URL ?? "http://localhost:5173"
).origin;

router.get("/", ...autenticar, obtenerBuses);
router.get("/grupos", ...autenticar, obtenerGruposBuses);

router.post(
  "/",
  (req, res, next) => {
    if (req.get("origin") !== origenPermitido) {
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

export default router;
