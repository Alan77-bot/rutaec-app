import { Router } from "express";
import { obtenerViajes } from "./reservas.controller.js";

const router = Router();

router.get("/viajes", obtenerViajes);

export default router;
