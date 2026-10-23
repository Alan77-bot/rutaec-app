import { Router } from "express";
import { obtenerFrecuencias } from "./horarios.controller.js";

const router = Router();

router.get("/frecuencias", obtenerFrecuencias);

export default router;
