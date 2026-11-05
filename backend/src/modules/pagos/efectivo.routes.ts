import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { bloquearOcupacionCompra } from './ocupacion-compra.js';
const router=Router(),uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
class ErrorCaja extends Error {constructor(public estado:number,mensaje:string){super(mensaje)}}
// Montado exclusivamente dentro del router autenticado de oficinistas.
router.post('/efectivo',async(req,res)=>{
  const s=res.locals.sesion,{compraId,claveIdempotencia,recibido,confirmado}=req.body??{};
  if(req.get('origin')!==new URL(process.env.FRONTEND_URL||'http://localhost:5173').origin)throw new ErrorCaja(403,'Origen no permitido.');
  if(s.rol!=='oficinista'||!s.coopId)throw new ErrorCaja(403,'Operación exclusiva de caja.');
  if(!uuid.test(String(compraId))||!uuid.test(String(claveIdempotencia))||confirmado!==true||!/^\d{1,8}(\.\d{1,2})?$/.test(String(recibido)))throw new ErrorCaja(400,'Confirma el efectivo recibido y revisa el importe.');
  const datos=await prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT set_config('app.usuario_id',${s.id},true)`;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${String(claveIdempotencia)},0))::text`;
    await tx.$queryRaw`SELECT id FROM rutaec.compras WHERE id=${compraId}::uuid FOR UPDATE`;
    const c=await tx.compras.findFirst({where:{id:compraId,cooperativa_id:s.coopId,canal:'VENTANILLA'}});
    if(!c)throw new ErrorCaja(404,'Venta de ventanilla no encontrada.');
    const previo=await tx.pagos.findUnique({where:{clave_idempotencia:claveIdempotencia}});
    if(previo){if(previo.compra_id!==c.id||previo.metodo!=='EFECTIVO')throw new ErrorCaja(409,'Solicitud utilizada en otra operación.');return {pagoId:previo.id,compraId:c.id};}
    if(c.estado!=='RESERVADA'||!c.vence_en||c.vence_en<=new Date())throw new ErrorCaja(409,'La reserva ya no admite el cobro.');
    if(Math.round(Number(recibido)*100)<Math.round(Number(c.total)*100))throw new ErrorCaja(400,'El efectivo recibido es menor que el total.');
    if(await tx.pagos.count({where:{compra_id:c.id,estado:{in:['PENDIENTE','EN_REVISION','CORRECCION','APROBADO','RECIBIDO_INCIDENCIA']}}}))throw new ErrorCaja(409,'La compra ya tiene un pago registrado.');
    if(!await bloquearOcupacionCompra(tx,c.id))throw new ErrorCaja(409,'Los asientos ya no están disponibles.');
    const pago=await tx.pagos.create({data:{compra_id:c.id,cooperativa_id:s.coopId,metodo:'EFECTIVO',proveedor:'CAJA_PRESENCIAL',estado:'APROBADO',importe:c.total,importe_recibido:c.total,moneda:c.moneda,moneda_recibida:c.moneda,recibido_en:new Date(),aprobado_en:new Date(),confirmado_por:s.id,sandbox:false,clave_idempotencia:claveIdempotencia,motivo:`Efectivo recibido ${Number(recibido).toFixed(2)}; cambio ${(Number(recibido)-Number(c.total)).toFixed(2)}`}});
    await tx.compras.update({where:{id:c.id},data:{estado:'CONFIRMADA',confirmada_en:new Date()}});
    await tx.$executeRaw`SELECT rutaec.emitir_boletos(${c.id}::uuid)`;
    await tx.$executeRaw`SELECT rutaec.encolar_evento('PAGO_APROBADO',${c.id}::uuid,${s.coopId}::uuid,${'efectivo:'+pago.id},${JSON.stringify({compra_id:c.id,pago_id:pago.id,metodo:'EFECTIVO',actor:s.id})}::jsonb)`;
    return {pagoId:pago.id,compraId:c.id};
  });
  res.json({datos,mensaje:'Efectivo registrado. Boleto y comprobante disponibles para imprimir.'});
});
router.use((e:unknown,_req:import('express').Request,res:import('express').Response,_next:import('express').NextFunction)=>res.status(e instanceof ErrorCaja?e.estado:409).json({error:e instanceof ErrorCaja?e.message:'No se pudo registrar el cobro. Actualiza la reserva antes de reintentar.'}));
export default router;
