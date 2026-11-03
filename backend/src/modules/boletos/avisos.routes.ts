import { Router } from 'express';
import { autenticar } from '../../middlewares/autenticacion.js';
import { prisma } from '../../lib/prisma.js';
const router = Router();
router.use(...autenticar);
router.get('/', async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ datos: await prisma.notificaciones.findMany({ where: { usuario_id: res.locals.sesion.id }, orderBy: { creada_en: 'desc' }, take: 100, select: { id:true,titulo:true,mensaje:true,destino_interno:true,creada_en:true,leida_en:true } }) });
});
router.post('/leidas', async (req, res) => {
  if (req.get('origin') !== new URL(process.env.FRONTEND_URL ?? 'http://localhost:5173').origin) { res.status(403).json({ error:'Origen no permitido.' }); return; }
  await prisma.notificaciones.updateMany({ where: { usuario_id:res.locals.sesion.id,leida_en:null }, data:{ leida_en:new Date() } });
  res.json({ mensaje:'Notificaciones leídas.' });
});
router.use((_e:unknown,_req:import('express').Request,res:import('express').Response,_next:import('express').NextFunction) => res.status(500).json({error:'No se pudieron consultar las notificaciones.'}));
export default router;
