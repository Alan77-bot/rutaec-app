import { Router } from "express";
import { autenticar } from "../../middlewares/autenticacion.js";
import { autorizarRoles } from "../../middlewares/autorizacion.js";
import {
  listarGerentes,
  listarUsuariosDisponibles,
  crearGerente,
  asignarGerente,
  editarGerente,
  cambiarEstadoGerente,
} from "./gerentes.controller.js";

const router = Router();

router.use(...autenticar, autorizarRoles("admin"));

router.get("/", listarGerentes);
router.get("/usuarios-disponibles", listarUsuariosDisponibles);
router.post("/", crearGerente);
router.post("/asignar-existente", asignarGerente);
router.patch("/:id", editarGerente);
router.patch("/:id/estado", cambiarEstadoGerente);

export default router;
