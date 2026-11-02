import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { autenticar } from "../../middlewares/autenticacion.js";
import { autorizarRoles } from "../../middlewares/autorizacion.js";
import { prisma } from "../../lib/prisma.js";
const router = Router();
router.use(...autenticar, autorizarRoles('oficinista'));
router.get('/resumen', async (_req,res) => {
  const coop=res.locals.sesion.coopId;
  if(!coop){res.status(403).json({error:'No tienes cooperativa asignada.'});return;}
  const [resumen]=await prisma.$queryRaw<{ cobrados:string; demostracion:string; devueltos:string; pendientes:number }[]>`
    SELECT
      (SELECT COALESCE(sum(importe_recibido),0)::text FROM rutaec.pagos WHERE cooperativa_id=${coop}::uuid AND estado='APROBADO' AND proveedor IS DISTINCT FROM 'DEMO_SIN_COBRO') AS cobrados,
      (SELECT COALESCE(sum(importe_recibido),0)::text FROM rutaec.pagos WHERE cooperativa_id=${coop}::uuid AND estado='APROBADO' AND proveedor='DEMO_SIN_COBRO') AS demostracion,
      (SELECT COALESCE(sum(r.importe),0)::text FROM rutaec.reembolsos r JOIN rutaec.pagos p ON p.id=r.pago_id WHERE p.cooperativa_id=${coop}::uuid AND r.estado='REALIZADO' AND p.proveedor IS DISTINCT FROM 'DEMO_SIN_COBRO') AS devueltos,
      (SELECT count(*)::int FROM rutaec.revisiones WHERE cooperativa_id=${coop}::uuid AND estado IN ('PENDIENTE','EN_REVISION','CORRECCION')) AS pendientes`;
  res.setHeader('Cache-Control','no-store');res.json({datos:resumen});
});
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
