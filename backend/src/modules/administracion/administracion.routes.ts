
import { Router } from "express";
import { consultarResumenAdministracion } from "./administracion.controller.js";

const router = Router();

router.get("/resumen", consultarResumenAdministracion);

export default router;
