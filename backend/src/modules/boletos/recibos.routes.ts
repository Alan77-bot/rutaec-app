import { Router } from 'express';
import { generarReciboCompra } from './recibos.pdf.js';
import { prisma } from '../../lib/prisma.js';
import { autenticar } from '../../middlewares/autenticacion.js';

const router=Router();
router.get('/recibos/:compraId',...autenticar,async(req,res)=>{
  const id=String(req.params.compraId),s=res.locals.sesion;
  if(!/^[0-9a-f-]{36}$/i.test(id)){res.status(400).json({error:'Compra inválida.'});return;}
  const c=await prisma.compras.findFirst({where:{id,...(s.rol==='admin'?{}:s.rol==='usuario'?{comprador_id:s.id}:{cooperativa_id:s.coopId??''})},include:{pagos:{where:{estado:'APROBADO'},orderBy:{aprobado_en:'desc'},take:1}}});
  if(!c||!c.pagos.length){res.status(404).json({error:'No existe comprobante de pago confirmado para esta compra.'});return;}
  const contenido=await generarReciboCompra(id);
  res.setHeader('Cache-Control','private, no-store');res.type('application/pdf');res.attachment(`recibo-${c.id.slice(0,8)}.pdf`);res.send(contenido);
});
router.use((_e:unknown,_req:import('express').Request,res:import('express').Response,_next:import('express').NextFunction)=>{if(!res.headersSent)res.status(500).json({error:'No se pudo generar el comprobante.'});else res.destroy();});
export default router;
