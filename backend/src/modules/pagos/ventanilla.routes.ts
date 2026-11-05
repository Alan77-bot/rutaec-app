import efectivoRoutes from './efectivo.routes.js';
import { compradorPresencial } from './comprador-presencial.js';
import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { autenticar } from "../../middlewares/autenticacion.js";
import { autorizarRoles } from "../../middlewares/autorizacion.js";
import { prisma } from "../../lib/prisma.js";
import comprobanteVentanilla from './comprobante-ventanilla.js';
const router = Router();
router.use(...autenticar, autorizarRoles('oficinista'));
router.use(comprobanteVentanilla);
router.use(efectivoRoutes);
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
router.post('/comprador',async(req,res)=>{
  if(req.get('origin')!==new URL(process.env.FRONTEND_URL||'http://localhost:5173').origin){res.status(403).json({error:'Origen no permitido.'});return;}
  try{res.json({datos:compradorPresencial(req.body)});}catch(e){res.status(400).json({error:e instanceof Error?e.message:'Datos inválidos.'});}
});
router.get('/salidas',async(req,res)=>{
  const coop=res.locals.sesion.coopId;
  const fecha=String(req.query.fecha||'');if(fecha&&!/^\d{4}-\d{2}-\d{2}$/.test(fecha)){res.status(400).json({error:'Fecha inválida.'});return;}
  const datos=await prisma.$queryRaw`SELECT v.id AS viaje_id, a.inicio AS salida, r.nombre AS ruta,
    (SELECT ci.nombre FROM rutaec.paradas_viaje p JOIN rutaec.terminales t ON t.id=p.terminal_id JOIN rutaec.ciudades ci ON ci.id=t.ciudad_id WHERE p.viaje_id=v.id ORDER BY p.orden LIMIT 1) AS origen_ciudad,
    (SELECT ci.nombre FROM rutaec.paradas_viaje p JOIN rutaec.terminales t ON t.id=p.terminal_id JOIN rutaec.ciudades ci ON ci.id=t.ciudad_id WHERE p.viaje_id=v.id ORDER BY p.orden DESC LIMIT 1) AS destino_ciudad,
    (SELECT COALESCE(min(capacidad_vendible-vendidos-retenidos),0)::int FROM rutaec.v_ocupacion_tramos WHERE viaje_id=v.id) AS cupos_disponibles
    FROM rutaec.viajes v JOIN rutaec.agenda_bus a ON a.id=v.agenda_id JOIN rutaec.rutas r ON r.id=v.ruta_id JOIN rutaec.frecuencias f ON f.id=v.frecuencia_id JOIN rutaec.cooperativas c ON c.id=v.cooperativa_id
    WHERE v.cooperativa_id=${coop}::uuid AND v.estado='PUBLICADO' AND v.cierre_ventas>clock_timestamp() AND f.activa AND c.activa
      AND (${fecha}='' OR (a.inicio AT TIME ZONE 'America/Guayaquil')::date::text=${fecha})
    ORDER BY a.inicio LIMIT 100`;
  res.setHeader('Cache-Control','no-store');res.json({datos});
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
