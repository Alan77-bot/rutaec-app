import { Router } from "express";
import { autenticar } from "../../middlewares/autenticacion.js";
import { autorizarRoles } from "../../middlewares/autorizacion.js";
import {
  editarRuta,
  obtenerCiudades,
  obtenerRutas,
  obtenerTerminales,
  registrarRuta,
} from "./rutas.controller.js";

const router = Router();

const soloGestion = [...autenticar, autorizarRoles("admin", "cooperativa")];

router.get("/", obtenerRutas);
router.get("/ciudades", obtenerCiudades);
router.get("/terminales", obtenerTerminales);
router.post("/", ...soloGestion, registrarRuta);
router.put("/:id", ...soloGestion, editarRuta);

export default router;
