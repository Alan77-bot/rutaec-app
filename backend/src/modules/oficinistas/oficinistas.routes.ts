import { Router } from "express";
import { autenticar } from "../../middlewares/autenticacion.js";
import { autorizarRoles } from "../../middlewares/autorizacion.js";
import {
  listarOficinistas,
  crearAsignacionOficinista,
  actualizarEstadoOficinista,
  listarUsuariosDisponiblesOficinista,
  crearNuevoOficinista,
} from "./oficinistas.controller.js";

const router = Router();

router.use(...autenticar, autorizarRoles("cooperativa"));

router.get("/", listarOficinistas);
router.get(
  "/usuarios-disponibles",
  listarUsuariosDisponiblesOficinista
);
router.post("/asignar-existente", crearAsignacionOficinista);
router.post("/crear", crearNuevoOficinista);
router.patch("/:id/estado", actualizarEstadoOficinista);

export default router;
