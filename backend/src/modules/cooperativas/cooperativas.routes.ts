
import { Router } from "express";
import { obtenerCooperativas } from "./cooperativas.controller.js";

const router = Router();

router.get("/", obtenerCooperativas);

export default router;
