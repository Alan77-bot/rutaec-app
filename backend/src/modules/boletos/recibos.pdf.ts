import PDFDocument from 'pdfkit';
import { prisma } from '../../lib/prisma.js';

export async function generarReciboCompra(id:string):Promise<Buffer> {
  const c=await prisma.compras.findUniqueOrThrow({where:{id},include:{pagos:{where:{estado:'APROBADO'},orderBy:{aprobado_en:'desc'},take:1}}});
  if(!c.pagos.length)throw new Error('No hay pago confirmado');
  const [cooperativa,detalles]=await Promise.all([prisma.cooperativas.findUniqueOrThrow({where:{id:c.cooperativa_id},select:{nombre_comercial:true,ruc:true}}),prisma.detalle_compra.findMany({where:{compra_id:id},select:{pasajero_snapshot:true,asiento_snapshot:true,precio_base:true,descuento:true,importe:true}})]);
  const evento=await prisma.eventos_salida.findFirst({where:{entidad_id:id,tipo:'RESERVA_SOLICITADA'},select:{datos:true}});
  const comprador=(evento?.datos as {comprador_presencial?:{nombres:string;apellidos:string;documento:string;correo?:string}}|undefined)?.comprador_presencial;
  const p=c.pagos[0],demo=p.proveedor==='DEMO_SIN_COBRO';
  const doc=new PDFDocument({size:'A4',margin:45});
  const partes:Buffer[]=[];
  const terminado=new Promise<Buffer>((resolve,reject)=>{doc.on('data',(b:Buffer)=>partes.push(b));doc.on('end',()=>resolve(Buffer.concat(partes)));doc.on('error',reject);});
  doc.fontSize(20).text(demo?'DEMOSTRACIÓN · SIN COBRO REAL':'Comprobante de venta · no fiscal');
  doc.fontSize(11).text('Recibo informativo. No es una factura electrónica autorizada por el SRI.');
  doc.moveDown().text(cooperativa.nombre_comercial).text(`RUC: ${cooperativa.ruc}`).text(`Compra: ${c.id}`).text(`Pago: ${p.id}`).text(`Método: ${p.metodo}`).text(`Estado de compra: ${c.estado}`).text(`Fecha: ${p.aprobado_en?.toISOString()??''}`);
  if(comprador) doc.moveDown().text(`Comprador: ${comprador.nombres} ${comprador.apellidos}`).text(`Documento: ${comprador.documento}`).text(comprador.correo||'');
  for(const d of detalles){const pasajero=d.pasajero_snapshot as {nombres?:string;apellidos?:string;numero_documento?:string};const asiento=d.asiento_snapshot as {numero?:string};doc.moveDown().text(`${pasajero.nombres??''} ${pasajero.apellidos??''} · ${pasajero.numero_documento??''} · Asiento ${asiento.numero??''}`).text(`Base ${d.precio_base} - descuento ${d.descuento} = ${d.importe}`);}
  doc.moveDown().fontSize(15).text(`Total: ${c.moneda} ${c.total}`);doc.fontSize(10).text('Las devoluciones se registran por separado. Conserva la referencia de tu operación bancaria.');doc.end();
  return terminado;
}
