
import { Router } from "express";
import {
  obtenerCooperativas,
  crearCooperativa,
  editarCooperativa,
  actualizarEstadoCooperativa,
  borrarCooperativa,
} from "./cooperativas.controller.js";
import { autenticar } from "../../middlewares/autenticacion.js";
import { autorizarRoles } from "../../middlewares/autorizacion.js";

const router = Router();

router.get("/", obtenerCooperativas);

router.post(
  "/",
  ...autenticar,
  autorizarRoles("admin"),
  crearCooperativa
);

router.patch(
  "/:id",
  ...autenticar,
  autorizarRoles("admin"),
  editarCooperativa
);

router.patch(
  "/:id/estado",
  ...autenticar,
  autorizarRoles("admin"),
  actualizarEstadoCooperativa
);

router.delete(
  "/:id",
  ...autenticar,
  autorizarRoles("admin"),
  borrarCooperativa
);

export default router;
