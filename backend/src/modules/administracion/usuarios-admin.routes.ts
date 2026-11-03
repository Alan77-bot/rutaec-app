
import { Router } from "express";
import { autenticar } from "../../middlewares/autenticacion.js";
import { autorizarRoles } from "../../middlewares/autorizacion.js";

import {
  listarUsuarios,
  obtenerUsuario,
  editarUsuario,
  cambiarEstadoUsuario,
} from "./usuarios-admin.controller.js";

const router = Router();

router.use(...autenticar, autorizarRoles("admin"));

router.get("/", listarUsuarios);
router.get("/:id", obtenerUsuario);
router.patch("/:id", editarUsuario);
router.patch("/:id/estado", cambiarEstadoUsuario);

export default router;
