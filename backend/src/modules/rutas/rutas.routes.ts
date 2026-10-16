import { Router } from "express";
import {
  editarRuta,
  obtenerCiudades,
  obtenerRutas,
  obtenerTerminales,
  registrarRuta,
} from "./rutas.controller.js";

const router = Router();

router.get("/", obtenerRutas);
router.get("/ciudades", obtenerCiudades);
router.get("/terminales", obtenerTerminales);
router.post("/", registrarRuta);
router.put("/:id", editarRuta);

export default router;
