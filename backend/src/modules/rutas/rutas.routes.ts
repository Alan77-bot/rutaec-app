import { Router } from "express";
import { obtenerCiudades, obtenerTerminales } from "./rutas.controller.js";

const router = Router();

router.get("/ciudades", obtenerCiudades);
router.get("/terminales", obtenerTerminales);

export default router;
