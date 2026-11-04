import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { autenticar } from "../../middlewares/autenticacion.js";
import { consultar, guardar, cambiarClave, solicitarCorreo, confirmarCorreo } from "./perfil.controller.js";

const router = Router();
router.use(...autenticar);
const limitarCambios = rateLimit({ windowMs: 15 * 60000, limit: 10, standardHeaders: true, legacyHeaders: false, keyGenerator: (_req, res) => res.locals.sesion.id, message: { error: "Demasiados intentos. Inténtalo en 15 minutos." } });
const limitarCodigo = rateLimit({ windowMs: 15 * 60000, limit: 5, standardHeaders: true, legacyHeaders: false, keyGenerator: (_req, res) => res.locals.sesion.id, message: { error: "Demasiados intentos de código. Espera 15 minutos y solicita uno nuevo." } });

router.get("/", consultar);
router.patch("/", guardar);
router.post("/clave", limitarCambios, cambiarClave);
router.post("/correo", limitarCambios, solicitarCorreo);
router.post("/correo/confirmar", limitarCodigo, confirmarCorreo);

export default router;
