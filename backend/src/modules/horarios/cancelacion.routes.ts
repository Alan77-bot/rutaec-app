import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { autenticar } from '../../middlewares/autenticacion.js';
import { autorizarRoles } from '../../middlewares/autorizacion.js';
const router=Router();
class ErrorCancelacion extends Error { constructor(public estado:number,mensaje:string){super(mensaje);} }
router.use(...autenticar,autorizarRoles('admin','cooperativa'));
router.get('/operacion/agenda',async(_req,res)=>{
  const s=res.locals.sesion;
  const filtro=s.rol==='admin'?{}:{cooperativa_id:s.coopId??''};
  const [buses,agenda]=await Promise.all([prisma.buses.findMany({where:filtro,select:{id:true,placa:true,cooperativa_id:true}}),prisma.agenda_bus.findMany({where:{...filtro,tipo:{in:['DESCANSO','MANTENIMIENTO']},activa:true,fin:{gte:new Date()}},orderBy:{inicio:'asc'},take:200})]);
  res.setHeader('Cache-Control','no-store');res.json({datos:{buses,agenda}});
});
router.post('/operacion/agenda',async(req,res)=>{
  const s=res.locals.sesion,{busId,tipo}=req.body??{},inicio=new Date(req.body?.inicio),fin=new Date(req.body?.fin),motivo=String(req.body?.motivo??'').trim();
  if(req.get('origin')!==new URL(process.env.FRONTEND_URL??'http://localhost:5173').origin)throw new ErrorCancelacion(403,'Origen no permitido.');
  if(typeof busId!=='string'||!/^[0-9a-f-]{36}$/i.test(busId)||!['DESCANSO','MANTENIMIENTO'].includes(tipo)||!Number.isFinite(inicio.getTime())||!Number.isFinite(fin.getTime())||fin<=inicio||motivo.length<5||motivo.length>500)throw new ErrorCancelacion(400,'Revisa bus, fechas, tipo y motivo.');
  const bus=await prisma.buses.findFirst({where:{id:busId,...(s.rol==='admin'?{}:{cooperativa_id:s.coopId??''})}});
  if(!bus)throw new ErrorCancelacion(404,'Bus no encontrado.');
  const datos=await prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT set_config('app.usuario_id',${s.id},true)`;
    return tx.agenda_bus.create({data:{bus_id:bus.id,cooperativa_id:bus.cooperativa_id,tipo,inicio,fin,motivo}});
  });
  res.status(201).json({datos,mensaje:'Bloqueo registrado. No se podrá programar un viaje que se cruce con este período.'});
});
router.post('/operacion/agenda/:id/liberar',async(req,res)=>{
  const s=res.locals.sesion,id=String(req.params.id),motivo=String(req.body?.motivo??'').trim();
  if(req.get('origin')!==new URL(process.env.FRONTEND_URL??'http://localhost:5173').origin)throw new ErrorCancelacion(403,'Origen no permitido.');
  if(!/^[0-9a-f-]{36}$/i.test(id)||motivo.length<5||motivo.length>500)throw new ErrorCancelacion(400,'Indica el bloqueo y un motivo.');
  const cantidad=await prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT set_config('app.usuario_id',${s.id},true)`;
    return tx.agenda_bus.updateMany({where:{id,activa:true,tipo:{in:['DESCANSO','MANTENIMIENTO']},...(s.rol==='admin'?{}:{cooperativa_id:s.coopId??''})},data:{activa:false,motivo:`Liberado: ${motivo}`}});
  });
  if(!cantidad.count)throw new ErrorCancelacion(404,'Bloqueo no encontrado o ya liberado.');
  res.json({mensaje:'Bloqueo liberado. El historial se conserva.'});
});
router.get('/cancelaciones/viajes',async(req,res)=>{
  const s=res.locals.sesion;
  if(s.rol!=='admin'&&!s.coopId)throw new ErrorCancelacion(403,'Sin cooperativa asignada.');
  const desde=new Date(String(req.query.desde??'')),hasta=new Date(String(req.query.hasta??''));
  if(!Number.isFinite(desde.getTime())||!Number.isFinite(hasta.getTime())||hasta<desde||hasta.getTime()-desde.getTime()>31*86400000)throw new ErrorCancelacion(400,'Selecciona un período de hasta 31 días.');
  hasta.setUTCDate(hasta.getUTCDate()+1);
  res.setHeader('Cache-Control','no-store');
  res.json({datos:await prisma.viajes.findMany({where:{...(s.rol==='admin'?{}:{cooperativa_id:s.coopId!}),agenda_bus:{inicio:{gte:desde,lt:hasta}}},include:{agenda_bus:{select:{inicio:true,fin:true}},cooperativas:{select:{nombre_comercial:true}},_count:{select:{compras:true}}},orderBy:{cierre_ventas:'asc'},take:200})});
});
router.post('/cancelaciones/viajes/:id',async(req,res)=>{
  const s=res.locals.sesion,id=String(req.params.id),motivo=String(req.body?.motivo??'').trim();
  if(req.get('origin')!==new URL(process.env.FRONTEND_URL??'http://localhost:5173').origin)throw new ErrorCancelacion(403,'Origen no permitido.');
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)||motivo.length<5||motivo.length>500)throw new ErrorCancelacion(400,'Indica el viaje y un motivo de 5 a 500 caracteres.');
  const resultado=await prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT set_config('app.usuario_id',${s.id},true)`;
    await tx.$queryRaw`SELECT id FROM rutaec.viajes WHERE id=${id}::uuid FOR UPDATE`;
    const v=await tx.viajes.findFirst({where:{id,...(s.rol==='admin'?{}:{cooperativa_id:s.coopId??''})}});
    if(!v)throw new ErrorCancelacion(404,'Viaje no encontrado.');
    if(v.estado==='CANCELADO')return {compras:0,repetida:true};
    const compras=await tx.compras.findMany({where:{viaje_id:id,estado:{notIn:['CANCELADA','RECHAZADA']}},include:{pagos:{where:{estado:{in:['APROBADO','RECIBIDO_INCIDENCIA','EN_REVISION','CORRECCION']}}}},orderBy:{id:'asc'}});
    await tx.viajes.update({where:{id},data:{estado:'CANCELADO',motivo_cancelacion:motivo}});
    for(const c of compras){
      await tx.$queryRaw`SELECT id FROM rutaec.compras WHERE id=${c.id}::uuid FOR UPDATE`;
      if(c.pagos.length){
        const anterior=await tx.incidencias.findFirst({where:{compra_id:c.id,tipo:'CANCELACION',estado:{in:['ABIERTA','EN_ATENCION']}}});
        if(!anterior)await tx.incidencias.create({data:{compra_id:c.id,cooperativa_id:v.cooperativa_id,pago_id:c.pagos[0].id,tipo:'CANCELACION',descripcion:`Viaje cancelado: ${motivo}. Evaluar devolución o alternativa con aceptación del cliente.`,creado_por:s.id}});
      }
      await tx.compras.update({where:{id:c.id},data:{estado:'CANCELADA',motivo:`Viaje cancelado: ${motivo}`,finalizada_en:new Date()}});
      await tx.boletos.updateMany({where:{compra_id:c.id,estado:'EMITIDO'},data:{estado:'ANULADO'}});
      await tx.$queryRaw`SELECT rutaec.encolar_evento('VIAJE_CANCELADO',${c.id}::uuid,${v.cooperativa_id}::uuid,${`viaje-cancelado:${id}:${c.id}`},${JSON.stringify({compra_id:c.id,motivo})}::jsonb)`;
    }
    await tx.agenda_bus.update({where:{id:v.agenda_id},data:{activa:false}});
    return {compras:compras.length,repetida:false};
  });
  res.json({datos:resultado,mensaje:'Viaje cancelado. Los pagos existentes quedan para conciliación o devolución manual; no se ha transferido dinero.'});
});
router.use((e:unknown,_req:import('express').Request,res:import('express').Response,_next:import('express').NextFunction)=>res.status(e instanceof ErrorCancelacion?e.estado:409).json({error:e instanceof ErrorCancelacion?e.message:'No se pudo cancelar el viaje. Actualiza e intenta de nuevo.'}));
export default router;
