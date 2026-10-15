import { Router } from "express";
import {
  obtenerCiudades,
  obtenerRutas,
  obtenerTerminales,
} from "./rutas.controller.js";

const router = Router();

router.get("/", obtenerRutas);
router.get("/ciudades", obtenerCiudades);
router.get("/terminales", obtenerTerminales);

export default router;
