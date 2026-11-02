import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { autenticar } from '../../middlewares/autenticacion.js';
import { autorizarRoles } from '../../middlewares/autorizacion.js';

const router=Router();
router.get('/',...autenticar,autorizarRoles('oficinista','cooperativa','admin'),async(req,res)=>{
  const s=res.locals.sesion;
  const coop=s.rol==='admin'?(String(req.query.cooperativaId??'')||null):s.coopId;
  if((s.rol!=='admin'&&!coop)||(coop&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(coop))){res.status(400).json({error:'Cooperativa inválida.'});return;}
  const inicio=String(req.query.desde??''),fin=String(req.query.hasta??'');
  const desde=new Date(`${inicio}T00:00:00-05:00`),hasta=new Date(`${fin}T00:00:00-05:00`);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(inicio)||!/^\d{4}-\d{2}-\d{2}$/.test(fin)||!Number.isFinite(desde.getTime())||!Number.isFinite(hasta.getTime())||desde.toISOString().slice(0,10)!==inicio||hasta.toISOString().slice(0,10)!==fin||hasta<desde||hasta.getTime()-desde.getTime()>366*86400000){res.status(400).json({error:'Selecciona un período válido de hasta un año.'});return;}
  hasta.setTime(hasta.getTime()+86400000);
  const datos=await prisma.$transaction(async tx=>{
    const compras=await tx.$queryRaw`SELECT estado,count(*)::int AS cantidad,COALESCE(sum(total),0)::text AS importe FROM rutaec.compras WHERE (${coop}::uuid IS NULL OR cooperativa_id=${coop}::uuid) AND creada_en>=${desde} AND creada_en<${hasta} GROUP BY estado ORDER BY estado`;
    const pagos=await tx.$queryRaw`SELECT metodo,estado,(proveedor='DEMO_SIN_COBRO') IS TRUE AS demostracion,count(*)::int AS cantidad,COALESCE(sum(importe),0)::text AS declarado,COALESCE(sum(importe_recibido),0)::text AS recibido FROM rutaec.pagos WHERE (${coop}::uuid IS NULL OR cooperativa_id=${coop}::uuid) AND creado_en>=${desde} AND creado_en<${hasta} GROUP BY metodo,estado,(proveedor='DEMO_SIN_COBRO') IS TRUE ORDER BY metodo,estado`;
    const ingresos=await tx.$queryRaw`SELECT COALESCE(sum(importe_recibido),0)::text AS cobrado FROM rutaec.pagos WHERE (${coop}::uuid IS NULL OR cooperativa_id=${coop}::uuid) AND proveedor IS DISTINCT FROM 'DEMO_SIN_COBRO' AND estado IN ('APROBADO','RECIBIDO_INCIDENCIA') AND recibido_en>=${desde} AND recibido_en<${hasta}`;
    const devoluciones=await tx.$queryRaw`SELECT r.estado,count(*)::int AS cantidad,COALESCE(sum(r.importe),0)::text AS importe FROM rutaec.reembolsos r JOIN rutaec.pagos p ON p.id=r.pago_id WHERE (${coop}::uuid IS NULL OR p.cooperativa_id=${coop}::uuid) AND p.proveedor IS DISTINCT FROM 'DEMO_SIN_COBRO' AND r.creado_en>=${desde} AND r.creado_en<${hasta} GROUP BY r.estado ORDER BY r.estado`;
    const devuelto=await tx.$queryRaw`SELECT COALESCE(sum(r.importe),0)::text AS devuelto FROM rutaec.reembolsos r JOIN rutaec.pagos p ON p.id=r.pago_id WHERE (${coop}::uuid IS NULL OR p.cooperativa_id=${coop}::uuid) AND p.proveedor IS DISTINCT FROM 'DEMO_SIN_COBRO' AND r.estado='REALIZADO' AND r.realizado_en>=${desde} AND r.realizado_en<${hasta}`;
    const revisiones=await tx.$queryRaw`SELECT tipo,estado,count(*)::int AS cantidad,round(avg(extract(epoch FROM (COALESCE(resuelto_en,clock_timestamp())-creado_en)))/60,1)::text AS minutos_promedio FROM rutaec.revisiones WHERE (${coop}::uuid IS NULL OR cooperativa_id=${coop}::uuid) AND creado_en>=${desde} AND creado_en<${hasta} GROUP BY tipo,estado ORDER BY tipo,estado`;
    const viajes=await tx.$queryRaw`SELECT v.estado,count(*)::int AS cantidad FROM rutaec.viajes v JOIN rutaec.agenda_bus a ON a.id=v.agenda_id WHERE (${coop}::uuid IS NULL OR v.cooperativa_id=${coop}::uuid) AND a.inicio>=${desde} AND a.inicio<${hasta} GROUP BY v.estado ORDER BY v.estado`;
    const ocupacion=await tx.$queryRaw`SELECT v.id AS viaje_id,a.inicio AS salida,p.orden AS origen_orden,p.orden+1 AS destino_orden,(SELECT count(*)::int FROM rutaec.asientos_viaje av WHERE av.viaje_id=v.id AND av.vendible) AS capacidad,count(d.id) FILTER (WHERE c.estado='CONFIRMADA')::int AS vendidos,count(d.id) FILTER (WHERE c.estado='EN_REVISION' OR (c.estado='RESERVADA' AND c.vence_en>clock_timestamp()))::int AS reservados FROM rutaec.viajes v JOIN rutaec.agenda_bus a ON a.id=v.agenda_id JOIN rutaec.paradas_viaje p ON p.viaje_id=v.id AND EXISTS(SELECT 1 FROM rutaec.paradas_viaje siguiente WHERE siguiente.viaje_id=v.id AND siguiente.orden=p.orden+1) LEFT JOIN rutaec.detalle_compra d ON d.viaje_id=v.id AND d.origen_orden<=p.orden AND d.destino_orden>p.orden AND d.estado<>'LIBERADO' LEFT JOIN rutaec.compras c ON c.id=d.compra_id WHERE (${coop}::uuid IS NULL OR v.cooperativa_id=${coop}::uuid) AND a.inicio>=${desde} AND a.inicio<${hasta} GROUP BY v.id,a.inicio,p.orden ORDER BY a.inicio,v.id,p.orden LIMIT 1000`;
    return {compras,pagos,ingresos,devoluciones,devuelto,revisiones,viajes,ocupacion};
  },{isolationLevel:'RepeatableRead'});
  res.setHeader('Cache-Control','private, no-store');res.json({datos:{...datos,periodo:{desde:inicio,hasta:fin,zona:'America/Guayaquil'},cooperativaId:coop}});
});
router.use((_e:unknown,_req:import('express').Request,res:import('express').Response,_next:import('express').NextFunction)=>res.status(500).json({error:'No se pudo generar el reporte operativo.'}));
export default router;
