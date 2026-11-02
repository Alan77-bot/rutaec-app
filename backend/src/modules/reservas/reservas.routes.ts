import descuentosRoutes from "./descuentos.routes.js";
import gestionRoutes from "./gestion.routes.js";
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

router.use("/descuentos", descuentosRoutes);
router.use(gestionRoutes);

export default router;
