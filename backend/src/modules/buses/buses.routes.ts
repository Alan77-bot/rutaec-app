import { Router } from "express";
import { autenticar } from "../../middlewares/autenticacion.js";
import { obtenerBuses } from "./buses.controller.js";

const router = Router();

router.get("/", ...autenticar, obtenerBuses);

export default router;
