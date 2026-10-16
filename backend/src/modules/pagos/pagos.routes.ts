import { Router } from "express";
import {
  obtenerPagos,
  obtenerPagosPendientes,
  registrarPago,
} from "./pagos.controller.js";

const router = Router();

router.get("/", obtenerPagos);
router.get("/pendientes", obtenerPagosPendientes);
router.post("/", registrarPago);

export default router;
