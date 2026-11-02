import { Router } from "express";
import { autenticar } from "../../middlewares/autenticacion.js";
import { prisma } from "../../lib/prisma.js";
const router = Router();
router.get("/cuentas/:compraId", ...autenticar, async (req, res) => {
  const s = res.locals.sesion;
  const id = String(req.params.compraId);
  if (!/^[a-f0-9-]{36}$/i.test(id)) { res.status(400).json({ error: "Compra inválida." }); return; }
  const filtro = s.rol === "usuario" ? { comprador_id: s.id } : s.rol === "oficinista" && s.coopId ? { cooperativa_id: s.coopId } : { comprador_id: s.id };
  const compra = await prisma.compras.findFirst({ where: { id, ...filtro }, select: { id: true, cooperativa_id: true, estado: true, total: true, moneda: true, vence_en: true } });
  if (!compra) { res.status(404).json({ error: "Compra no encontrada." }); return; }
  const cuentas = await prisma.cuentas_bancarias.findMany({ where: { cooperativa_id: compra.cooperativa_id, activa: true }, select: { id: true, banco: true, numero: true, titular: true, tipo: true } });
  const pagos = await prisma.pagos.findMany({ where: { compra_id: id }, orderBy: { creado_en: "desc" }, select: { id: true, estado: true, motivo: true } });
  res.setHeader("Cache-Control", "no-store");
  res.json({ datos: { compra, cuentas, pagos, ventanilla: s.rol === "oficinista", tarjeta: { habilitada: process.env.NODE_ENV !== "production" && process.env.TARJETA_MODO_DEMO === "true", mensaje: "Solo demostración local; nunca se realiza un cobro real." } } });
});
router.use((_e: unknown, _req: import("express").Request, res: import("express").Response, _next: import("express").NextFunction) => { res.status(500).json({ error: "No se pudo consultar la información de pago." }); });
export default router;
