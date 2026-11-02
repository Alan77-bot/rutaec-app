import { Router } from 'express';
import PDFDocument from 'pdfkit';
import { prisma } from '../../lib/prisma.js';
import { autenticar } from '../../middlewares/autenticacion.js';

const router=Router();
router.get('/recibos/:compraId',...autenticar,async(req,res)=>{
  const id=String(req.params.compraId),s=res.locals.sesion;
  if(!/^[0-9a-f-]{36}$/i.test(id)){res.status(400).json({error:'Compra inválida.'});return;}
  const c=await prisma.compras.findFirst({where:{id,...(s.rol==='admin'?{}:s.rol==='usuario'?{comprador_id:s.id}:{cooperativa_id:s.coopId??''})},include:{pagos:{where:{estado:'APROBADO'},orderBy:{aprobado_en:'desc'},take:1}}});
  if(!c||!c.pagos.length){res.status(404).json({error:'No existe comprobante de pago confirmado para esta compra.'});return;}
  const [cooperativa,detalles]=await Promise.all([prisma.cooperativas.findUniqueOrThrow({where:{id:c.cooperativa_id},select:{nombre_comercial:true,ruc:true}}),prisma.detalle_compra.findMany({where:{compra_id:id},select:{pasajero_snapshot:true,asiento_snapshot:true,precio_base:true,descuento:true,importe:true}})]);
  const p=c.pagos[0],demo=p.proveedor==='DEMO_SIN_COBRO';
  const doc=new PDFDocument({size:'A4',margin:45});
  res.setHeader('Cache-Control','private, no-store');res.type('application/pdf');res.attachment(`recibo-${c.id.slice(0,8)}.pdf`);doc.pipe(res);
  doc.fontSize(20).text(demo?'DEMOSTRACIÓN · SIN COBRO REAL':'Comprobante de pago');
  doc.fontSize(11).text('Recibo informativo. No es una factura electrónica autorizada por el SRI.');
  doc.moveDown().text(cooperativa.nombre_comercial).text(`RUC: ${cooperativa.ruc}`).text(`Compra: ${c.id}`).text(`Pago: ${p.id}`).text(`Método: ${p.metodo}`).text(`Estado de compra: ${c.estado}`).text(`Fecha: ${p.aprobado_en?.toISOString()??''}`);
  for(const d of detalles){const pasajero=d.pasajero_snapshot as {nombres?:string;apellidos?:string};const asiento=d.asiento_snapshot as {numero?:string};doc.moveDown().text(`${pasajero.nombres??''} ${pasajero.apellidos??''} · Asiento ${asiento.numero??''}`).text(`Base ${d.precio_base} - descuento ${d.descuento} = ${d.importe}`);}
  doc.moveDown().fontSize(15).text(`Total: ${c.moneda} ${c.total}`);doc.fontSize(10).text('Las devoluciones se registran por separado. Conserva la referencia de tu operación bancaria.');doc.end();
});
router.use((_e:unknown,_req:import('express').Request,res:import('express').Response,_next:import('express').NextFunction)=>{if(!res.headersSent)res.status(500).json({error:'No se pudo generar el comprobante.'});else res.destroy();});
export default router;
