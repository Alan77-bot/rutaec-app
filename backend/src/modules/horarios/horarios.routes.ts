import { Router } from "express";
import { autenticar } from "../../middlewares/autenticacion.js";
import { autorizarRoles } from "../../middlewares/autorizacion.js";
import {
  obtenerFrecuencias,
  obtenerResoluciones,
} from "./horarios.controller.js";

const router = Router();

const soloGestion = [...autenticar, autorizarRoles("admin", "cooperativa")];

router.get("/frecuencias", obtenerFrecuencias);
router.get("/resoluciones", ...soloGestion, obtenerResoluciones);

export default router;
