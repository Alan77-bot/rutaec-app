import { Router } from "express";
import { autenticar } from "../../middlewares/autenticacion.js";
import {
  cargarComprobante,
  recibirArchivo,
} from "./comprobantes.controller.js";
import {
  obtenerPagos,
  obtenerPagosPendientes,
  registrarPago,
} from "./pagos.controller.js";

const router = Router();

router.get("/", obtenerPagos);
router.get("/pendientes", obtenerPagosPendientes);
router.post("/", registrarPago);
router.post("/:id/comprobante", autenticar, recibirArchivo, cargarComprobante);

export default router;
