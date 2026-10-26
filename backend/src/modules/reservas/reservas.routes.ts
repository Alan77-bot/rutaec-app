import { Router } from "express";
import {
  obtenerCiudades,
  obtenerDisponibilidadViaje,
  obtenerViajes,
} from "./reservas.controller.js";

const router = Router();

router.get("/viajes", obtenerViajes);
router.get("/ciudades", obtenerCiudades);
router.get("/disponibilidad", obtenerDisponibilidadViaje);

export default router;
