import { Router } from "express";
import { autenticar } from "../../middlewares/autenticacion.js";
import { autorizarRoles } from "../../middlewares/autorizacion.js";
import {
  cambiarCierreVentas,
  cancelarViajeProgramado,
  editarFrecuencia,
  obtenerBuses,
  obtenerFrecuencias,
  obtenerResoluciones,
  obtenerViajes,
  programarViajesFrecuencia,
  registrarFrecuencia,
} from "./horarios.controller.js";

const router = Router();

const soloGestion = [...autenticar, autorizarRoles("admin", "cooperativa")];

router.get("/frecuencias", obtenerFrecuencias);
router.post("/frecuencias", ...soloGestion, registrarFrecuencia);
router.put("/frecuencias/:id", ...soloGestion, editarFrecuencia);
router.get("/resoluciones", ...soloGestion, obtenerResoluciones);
router.get("/buses", ...soloGestion, obtenerBuses);
router.get("/viajes", ...soloGestion, obtenerViajes);
router.post("/viajes/programar", ...soloGestion, programarViajesFrecuencia);
router.patch("/viajes/:id/cancelar", ...soloGestion, cancelarViajeProgramado);
router.patch("/viajes/:id/cierre", ...soloGestion, cambiarCierreVentas);

export default router;
