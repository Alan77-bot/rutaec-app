import { Router } from "express";
import { obtenerCiudades } from "./rutas.controller.js";

const router = Router();

router.get("/ciudades", obtenerCiudades);

export default router;
