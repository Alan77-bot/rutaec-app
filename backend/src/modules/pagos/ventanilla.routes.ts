import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { autenticar } from "../../middlewares/autenticacion.js";
import { autorizarRoles } from "../../middlewares/autorizacion.js";
import { prisma } from "../../lib/prisma.js";
const router = Router();
router.use(...autenticar, autorizarRoles('oficinista'));
router.get('/comprador', rateLimit({ windowMs: 60000, limit: 20, legacyHeaders: false, standardHeaders: true }), async (req, res) => {
  const correo = typeof req.query.correo === 'string' ? req.query.correo.trim().toLowerCase() : '';
  if (correo.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) { res.status(400).json({ error: 'Escribe el correo del comprador.' }); return; }
  const comprador = await prisma.usuarios.findFirst({ where: { correo: { equals: correo, mode: 'insensitive' }, activo: true, correo_verificado_en: { not: null }, roles_globales: { some: { rol: 'CLIENTE' } } }, select: { id: true, nombres: true, apellidos: true, correo: true } });
  res.setHeader('Cache-Control','no-store');
  if (!comprador) { res.status(404).json({ error: 'No se encontró una cuenta de cliente activa y verificada. El comprador debe registrarse y verificar su correo antes de vender.' }); return; }
  res.json({ datos: comprador });
});
router.use((_e: unknown, _req: import('express').Request, res: import('express').Response, _next: import('express').NextFunction) => { res.status(500).json({ error: 'No se pudo consultar el comprador.' }); });
export default router;
