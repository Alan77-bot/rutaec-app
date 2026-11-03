import { Router } from "express";
import { autenticar } from "../../middlewares/autenticacion.js";
import { autorizarRoles } from "../../middlewares/autorizacion.js";
import {
  listarOficinistas,
  crearAsignacionOficinista,
  actualizarEstadoOficinista,
} from "./oficinistas.controller.js";

const router = Router();

router.use(...autenticar, autorizarRoles("cooperativa"));

router.get("/", listarOficinistas);
router.post("/asignar-existente", crearAsignacionOficinista);
router.patch("/:id/estado", actualizarEstadoOficinista);

export default router;
