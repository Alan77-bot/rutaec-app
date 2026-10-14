import { Router } from "express";
import { obtenerPagos } from "./pagos.controller.js";

const router = Router();

router.get("/", obtenerPagos);

export default router;
