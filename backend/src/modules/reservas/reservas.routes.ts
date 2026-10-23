import { Router } from "express";
import { obtenerCiudades, obtenerViajes } from "./reservas.controller.js";

const router = Router();

router.get("/viajes", obtenerViajes);
router.get("/ciudades", obtenerCiudades);

export default router;
