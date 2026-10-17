import { Router } from "express";
import { autenticar } from "../../middlewares/autenticacion.js";
import { autorizarRoles } from "../../middlewares/autorizacion.js";
import {
  cargarComprobante,
  descargarComprobante,
  recibirArchivo,
} from "./comprobantes.controller.js";
import {
  obtenerPagos,
  obtenerPagosPendientes,
  registrarPago,
} from "./pagos.controller.js";

const router = Router();

router.get("/", ...autenticar, obtenerPagos);
router.get(
  "/pendientes",
  ...autenticar,
  autorizarRoles("admin", "cooperativa", "oficinista"),
  obtenerPagosPendientes
);
router.post("/", ...autenticar, autorizarRoles("usuario"), registrarPago);
router.post(
  "/:id/comprobante",
  ...autenticar,
  autorizarRoles("usuario"),
  recibirArchivo,
  cargarComprobante
);
router.get("/:id/comprobante", ...autenticar, descargarComprobante);

export default router;
