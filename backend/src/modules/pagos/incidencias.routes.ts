import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { autenticar } from '../../middlewares/autenticacion.js';

class ErrorIncidencia extends Error { constructor(public estado:number,mensaje:string){super(mensaje);} }
const router=Router();const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
router.use(...autenticar);
router.use((req,res,next)=>{res.setHeader('Cache-Control','no-store');if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.get('origin')!==new URL(process.env.FRONTEND_URL??'http://localhost:5173').origin){res.status(403).json({error:'Origen no permitido.'});return;}next();});
function filtro(s:any){if(s.rol==='admin')return{};if(s.rol==='usuario')return{compras:{comprador_id:s.id}};if(s.rol==='oficinista'&&s.coopId)return{cooperativa_id:s.coopId};throw new ErrorIncidencia(403,'Operación no permitida.');}
function razon(x:unknown){if(typeof x!=='string'||!x.trim()||x.trim().length>1000)throw new ErrorIncidencia(400,'Indica el motivo (máximo 1000 caracteres).');return x.trim();}
router.get('/',async(_req,res)=>{res.json({datos:await prisma.incidencias.findMany({where:filtro(res.locals.sesion),include:{reembolsos:true,pagos:{select:{id:true,estado:true,importe_recibido:true,metodo:true,sandbox:true}}},orderBy:{creado_en:'desc'},take:100})});});
router.post('/',async(req,res)=>{
  const s=res.locals.sesion;filtro(s);const {compraId,tipo}=req.body??{};const descripcion=razon(req.body?.motivo);
  if(typeof compraId!=='string'||!UUID.test(compraId)||!['CANCELACION','PAGO_TARDIO','DEVOLUCION'].includes(tipo))throw new ErrorIncidencia(400,'Compra o solicitud inválida.');
  const compra=await prisma.compras.findFirst({where:{id:compraId,...(s.rol==='usuario'?{comprador_id:s.id}:s.rol==='admin'?{}:{cooperativa_id:s.coopId})}});
  if(!compra)throw new ErrorIncidencia(404,'Compra no encontrada.');
  const datos=await prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM rutaec.compras WHERE id=${compraId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT set_config('app.usuario_id',${s.id},true)`;
    const anterior=await tx.incidencias.findFirst({where:{compra_id:compraId,tipo,estado:{in:['ABIERTA','EN_ATENCION']}}});if(anterior)return anterior;
    const pago=await tx.pagos.findFirst({where:{compra_id:compraId,estado:{in:['APROBADO','RECIBIDO_INCIDENCIA']}},orderBy:{recibido_en:'desc'}});
    const i=await tx.incidencias.create({data:{compra_id:compraId,cooperativa_id:compra.cooperativa_id,pago_id:pago?.id,tipo,descripcion,creado_por:s.id}});
    await tx.$executeRaw`SELECT rutaec.encolar_evento('INCIDENCIA_RECIBIDA',${i.id}::uuid,${compra.cooperativa_id}::uuid,${'incidencia:'+i.id},${JSON.stringify({compra_id:compraId})}::jsonb)`;
    return i;
  });res.status(201).json({datos,mensaje:'Solicitud registrada para revisión manual; no se ha devuelto dinero ni reasignado asientos.'});
});
router.post('/:id/resolver',async(req,res)=>{
  const s=res.locals.sesion;if(!['admin','oficinista'].includes(s.rol))throw new ErrorIncidencia(403,'Solo personal autorizado puede resolver incidencias.');
  const id=String(req.params.id);if(!UUID.test(id))throw new ErrorIncidencia(400,'Incidencia inválida.');
  const i=await prisma.incidencias.findFirst({where:{id,...filtro(s)}});if(!i)throw new ErrorIncidencia(404,'Incidencia no encontrada.');
  const resolucion=razon(req.body?.motivo);const decision=req.body?.decision;
  if(!['CERRAR','REEMBOLSO','REGISTRAR_PAGO_TARDIO'].includes(decision))throw new ErrorIncidencia(400,'Decisión inválida.');
  await prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM rutaec.compras WHERE id=${i.compra_id}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM rutaec.incidencias WHERE id=${id}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT set_config('app.usuario_id',${s.id},true)`;
    const actual=await tx.incidencias.findUniqueOrThrow({where:{id}});if(actual.estado==='RESUELTA')throw new ErrorIncidencia(409,'La incidencia ya fue resuelta.');
    if(decision==='REGISTRAR_PAGO_TARDIO'){
      const {cuentaId,metodo,importe,referencia}=req.body;
      if(actual.pago_id||!UUID.test(String(cuentaId))||!['DEPOSITO','TRANSFERENCIA'].includes(metodo)||!/^\d+(\.\d{1,2})?$/.test(String(importe))||Number(importe)<=0)throw new ErrorIncidencia(400,'Comprueba cuenta, método e importe recibido.');
      const cuenta=await tx.cuentas_bancarias.findFirst({where:{id:cuentaId,cooperativa_id:i.cooperativa_id,activa:true}});if(!cuenta)throw new ErrorIncidencia(400,'Cuenta inválida.');
      const ref=razon(referencia);
      const previo=await tx.comprobantes_pago.findFirst({where:{numero_referencia:ref,pagos:{cooperativa_id:i.cooperativa_id}}});if(previo)throw new ErrorIncidencia(409,'La referencia ya consta en otro pago.');
      const pago=await tx.pagos.create({data:{compra_id:i.compra_id,cooperativa_id:i.cooperativa_id,metodo,estado:'RECIBIDO_INCIDENCIA',proveedor:'BANCO:'+i.cooperativa_id+':'+cuentaId,referencia_proveedor:ref,importe:String(importe),importe_recibido:String(importe),moneda_recibida:'USD',cuenta_bancaria_id:cuentaId,clave_idempotencia:randomUUID(),recibido_en:new Date(),confirmado_por:s.id,motivo:`Pago tardío verificado. Referencia: ${ref}`}});
      await tx.incidencias.update({where:{id},data:{pago_id:pago.id,estado:'EN_ATENCION',asignado_a:s.id,resolucion}});
      // Nunca se confirma la compra ni se ocupa otro asiento por registrar dinero tardío.
    }else{
      if(decision==='REEMBOLSO'){
        if(!actual.pago_id)throw new ErrorIncidencia(409,'Primero debe comprobarse el dinero recibido.');
        const importe=String(req.body?.importe);if(!/^\d+(\.\d{1,2})?$/.test(importe)||Number(importe)<=0)throw new ErrorIncidencia(400,'Importe inválido.');
        await tx.$queryRaw`SELECT id FROM rutaec.pagos WHERE id=${actual.pago_id}::uuid FOR UPDATE`;
        const pago=await tx.pagos.findUniqueOrThrow({where:{id:actual.pago_id}});
        const otros=await tx.reembolsos.aggregate({where:{pago_id:pago.id,estado:{not:'RECHAZADO'}},_sum:{importe:true}});
        const restante=Math.round(Number(pago.importe_recibido??0)*100)-Math.round(Number(otros._sum.importe??0)*100);
        if(Math.round(Number(importe)*100)>restante)throw new ErrorIncidencia(409,'El importe supera el saldo recibido y no comprometido.');
        await tx.reembolsos.create({data:{incidencia_id:id,pago_id:pago.id,importe,motivo:resolucion,estado:'APROBADO',gestionado_por:s.id}});
        if(req.body?.cancelarCompra===true){
          await tx.compras.update({where:{id:i.compra_id},data:{estado:'CANCELADA',motivo:resolucion,finalizada_en:new Date()}});
          await tx.boletos.updateMany({where:{compra_id:i.compra_id,estado:'EMITIDO'},data:{estado:'ANULADO',anulado_en:new Date(),motivo_anulacion:resolucion}});
        }
      }
      await tx.incidencias.update({where:{id},data:{estado:'RESUELTA',resolucion,resuelto_en:new Date(),asignado_a:s.id}});
    }
    await tx.$executeRaw`SELECT rutaec.encolar_evento('INCIDENCIA_RESUELTA',${id}::uuid,${i.cooperativa_id}::uuid,${'incidencia-decision:'+id+':'+decision},${JSON.stringify({compra_id:i.compra_id,decision})}::jsonb)`;
  });res.json({mensaje:'Decisión registrada. Un reembolso aprobado no significa que ya se haya devuelto el dinero.'});
});
router.post('/reembolsos/:id/realizado',async(req,res)=>{
  const s=res.locals.sesion;if(!['admin','oficinista'].includes(s.rol))throw new ErrorIncidencia(403,'Sin permiso.');
  const id=String(req.params.id);if(!UUID.test(id))throw new ErrorIncidencia(400,'Reembolso inválido.');const referencia=razon(req.body?.referencia);
  const r=await prisma.reembolsos.findFirst({where:{id,incidencias:filtro(s)},include:{incidencias:true}});if(!r)throw new ErrorIncidencia(404,'Reembolso no encontrado.');
  await prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT set_config('app.usuario_id',${s.id},true)`;
    const resultado=await tx.reembolsos.updateMany({where:{id,estado:'APROBADO'},data:{estado:'REALIZADO',referencia,realizado_en:new Date(),gestionado_por:s.id}});if(resultado.count!==1)throw new ErrorIncidencia(409,'El reembolso ya se procesó o no está aprobado.');
    await tx.$executeRaw`SELECT rutaec.encolar_evento('REEMBOLSO_REALIZADO',${r.incidencia_id}::uuid,${r.incidencias.cooperativa_id}::uuid,${'reembolso:'+id},${JSON.stringify({compra_id:r.incidencias.compra_id})}::jsonb)`;
  });res.json({mensaje:'Devolución confirmada con referencia. No se efectuó una transferencia automática desde RutaEC.'});
});
router.use((e:unknown,_req:import('express').Request,res:import('express').Response,_next:import('express').NextFunction)=>{res.status(e instanceof ErrorIncidencia?e.estado:409).json({error:e instanceof ErrorIncidencia?e.message:'No se pudo completar la incidencia. Actualiza y revisa los datos.'});});
export default router;
