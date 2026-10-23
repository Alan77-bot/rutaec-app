import { Router } from "express";
import { autenticar } from "../../middlewares/autenticacion.js";
import { autorizarRoles } from "../../middlewares/autorizacion.js";
import {
  obtenerFrecuencias,
  obtenerResoluciones,
  registrarFrecuencia,
} from "./horarios.controller.js";

const router = Router();

const soloGestion = [...autenticar, autorizarRoles("admin", "cooperativa")];

router.get("/frecuencias", obtenerFrecuencias);
router.post("/frecuencias", ...soloGestion, registrarFrecuencia);
router.get("/resoluciones", ...soloGestion, obtenerResoluciones);

export default router;
