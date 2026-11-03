import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { autenticar } from "../../middlewares/autenticacion.js";
import { ErrorReserva, crearReserva, detalleReserva, listarReservas, cancelarReserva } from "./gestion.service.js";

const router = Router();
router.use(...autenticar);
router.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.get("origin") !== new URL(process.env.FRONTEND_URL ?? "http://localhost:5173").origin) { res.status(403).json({ error: "Origen no permitido." }); return; }
  next();
});
router.get("/mias", async (_req, res) => { res.json({ datos: await listarReservas(res.locals.sesion) }); });
router.post("/compras", rateLimit({ windowMs: 60000, limit: 20, legacyHeaders: false, standardHeaders: true }), async (req, res) => { res.status(201).json({ datos: await crearReserva(res.locals.sesion, req.body) }); });
router.get("/compras/:id", async (req, res) => { res.json({ datos: await detalleReserva(res.locals.sesion, String(req.params.id)) }); });
router.post("/compras/:id/cancelar", async (req, res) => { res.json({ datos: await cancelarReserva(res.locals.sesion, String(req.params.id), req.body?.motivo) }); });
router.use((e: unknown, _req: import("express").Request, res: import("express").Response, _next: import("express").NextFunction) => {
  if (e instanceof ErrorReserva) { res.status(e.estado).json({ error: e.message }); return; }
  const meta = e as { code?: string; meta?: { code?: string } };
  const code = meta.meta?.code ?? meta.code;
  res.status(["23P01", "23505", "P2002", "P2010", "P0001"].includes(code ?? "") ? 409 : 500).json({ error: "No se pudo completar la reserva. Actualiza la disponibilidad y revisa los datos." });
});
export default router;
