import { Router } from "express";
import { obtenerPagos, obtenerPagosPendientes } from "./pagos.controller.js";

const router = Router();

router.get("/", obtenerPagos);
router.get("/pendientes", obtenerPagosPendientes);

export default router;
