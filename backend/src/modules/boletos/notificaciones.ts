import { prisma } from '../../lib/prisma.js';
import { obtenerTransporte } from '../usuarios/correo.transporte.js';

type Evento = { id:string; tipo:string; entidad_id:string; cooperativa_id:string|null; datos:Record<string,unknown>; intentos:number };
const titulos:Record<string,string> = {
  COMPRA_RESERVADA:'Reserva creada', COMPRA_VENCIDA:'Reserva vencida y asiento liberado', COMPRA_CANCELADA:'Compra cancelada', COMPRA_RECHAZADA:'Pago o compra rechazados', COMPRA_EN_REVISION:'Pago en revisión', COMPRA_CONFIRMADA:'Compra confirmada',
  COMPROBANTE_RECIBIDO:'Comprobante recibido', COMPROBANTE_CORREGIDO:'Corrección de comprobante recibida',
  DOCUMENTO_RECIBIDO:'Documento recibido para revisión', DESCUENTO_APROBADA:'Descuento aprobado', DESCUENTO_RECHAZADA:'Descuento rechazado', DESCUENTO_CORRECCION:'Corrección de documento solicitada',
  REVISION_PAGO_APROBAR:'Resultado de revisión de pago', REVISION_PAGO_RECHAZAR:'Pago rechazado', REVISION_PAGO_CORREGIR:'Corrección del pago solicitada',
  INCIDENCIA_RECIBIDA:'Solicitud recibida', INCIDENCIA_RESUELTA:'Actualización de tu solicitud', REEMBOLSO_REALIZADO:'Devolución registrada', CUENTA_CORREO_CAMBIADO:'Correo de la cuenta actualizado', CUENTA_CLAVE_CAMBIADA:'Contraseña actualizada',
};
async function contexto(e:Evento) {
  if(e.tipo.startsWith('CUENTA_')) {
    const u=await prisma.usuarios.findUnique({where:{id:e.entidad_id},select:{correo:true}});
    return {destinatarios:[...new Set([u?.correo,typeof e.datos.correo_anterior==='string'?e.datos.correo_anterior:null].filter((c):c is string=>!!c))],compraId:null as string|null,texto:'Si no reconoces este cambio, contacta con soporte y recupera tu cuenta.',destino:'/perfil'};
  }
  if(e.tipo==='DOCUMENTO_RECIBIDO'||e.tipo.startsWith('DESCUENTO_')){
    const v=await prisma.validaciones_descuento.findUnique({where:{id:e.entidad_id},include:{pasajeros:{include:{usuarios:{select:{correo:true}}}}}});
    if(!v)throw new Error('Solicitud inexistente');
    return {destinatarios:[v.pasajeros.usuarios.correo],compraId:null as string|null,texto:`Estado: ${v.estado}. ${v.motivo??'Tu documento será revisado por un oficinista; no se reserva ningún asiento por esta solicitud.'}`,destino:'/descuentos'};
  }
  const compraId=typeof e.datos.compra_id==='string'?e.datos.compra_id:e.tipo.startsWith('COMPRA_')?e.entidad_id:null;
  if(!compraId)throw new Error('Evento sin compra');
  const c=await prisma.compras.findUnique({where:{id:compraId},include:{pagos:{select:{motivo:true,proveedor:true}},incidencias:{select:{resolucion:true},orderBy:{creado_en:'desc'},take:1}}});
  if(!c)throw new Error('Compra inexistente');
  const cooperativa=await prisma.cooperativas.findUniqueOrThrow({where:{id:c.cooperativa_id},select:{nombre_comercial:true}});
  const demo=c.pagos.some(p=>p.proveedor==='DEMO_SIN_COBRO');
  const detalle=`${demo?'DEMOSTRACIÓN: SIN COBRO REAL. ':''}Compra: ${c.id}. Cooperativa: ${cooperativa.nombre_comercial}. Estado actual: ${c.estado}. Total: ${c.moneda} ${c.total}. ${c.vence_en?`Vencimiento de reserva: ${c.vence_en.toISOString()}.`:''} ${c.motivo??''} ${c.pagos.map(p=>p.motivo??'').join(' ')} ${c.incidencias[0]?.resolucion??''}`;
  return {destinatarios:[c.correo_destino],compraId,texto:detalle,destino:`/reserva/${c.id}`};
}

export function iniciarNotificacionesTramites() {
  let ocupado=false;
  const ciclo=async()=>{
    if(ocupado)return;ocupado=true;
    try{
      for(let n=0;n<20;n++){
        const filas=await prisma.$queryRaw<Evento[]>`UPDATE rutaec.eventos_salida SET estado='PROCESANDO',intentos=intentos+1,bloqueado_hasta=clock_timestamp()+interval '5 minutes'
          WHERE id=(SELECT id FROM rutaec.eventos_salida WHERE tipo=ANY(${Object.keys(titulos)}::text[]) AND ((estado='PENDIENTE' AND disponible_en<=clock_timestamp()) OR (estado='PROCESANDO' AND bloqueado_hasta<clock_timestamp())) ORDER BY creado_en LIMIT 1 FOR UPDATE SKIP LOCKED)
          RETURNING id,tipo,entidad_id,cooperativa_id,datos,intentos`;
        const e=filas[0];if(!e)break;
        try{
          const c=await contexto(e);
          for(const destinatario of c.destinatarios){
            const clave=`tramite:${e.id}:${destinatario}`;
            const envio=await prisma.envios_correo.upsert({where:{clave_deduplicacion:clave},update:{},create:{evento_id:e.id,destinatario,plantilla:e.tipo,compra_id:c.compraId,clave_deduplicacion:clave}});
            if(envio.estado==='ENVIADO')continue;
            const {transporte,usuario}=obtenerTransporte();
            const base=process.env.FRONTEND_URL??'http://localhost:5173';
            const resultado=await transporte.sendMail({from:{name:'RutaEC',address:usuario},to:destinatario,subject:`RutaEC · ${titulos[e.tipo]}`,messageId:`<tramite-${envio.id}@rutaec.local>`,text:`${titulos[e.tipo]}\n\n${c.texto}\n\nConsulta el detalle: ${new URL(c.destino,base).toString()}\n\nEste aviso no contiene documentos de identidad ni datos de tarjeta.`});
            if(!resultado.accepted.length)throw new Error('No aceptado');
            await prisma.envios_correo.update({where:{id:envio.id},data:{estado:'ENVIADO',enviado_en:new Date(),proveedor_id:resultado.messageId,intentos:{increment:1},ultimo_error:null}});
          }
          await prisma.eventos_salida.update({where:{id:e.id},data:{estado:'COMPLETADO',procesado_en:new Date(),bloqueado_hasta:null}});
        }catch{
          await prisma.eventos_salida.update({where:{id:e.id},data:{estado:e.intentos>=5?'ERROR':'PENDIENTE',disponible_en:new Date(Date.now()+e.intentos*60000),bloqueado_hasta:null,ultimo_error:'No se pudo entregar el aviso. Revisa SMTP y los datos del evento.'}});
          console.error('[notificaciones] No se pudo entregar un evento; se conserva para revisión o reintento.');
        }
      }
    }catch{console.error('[notificaciones] No se pudo consultar la cola de avisos.');}finally{ocupado=false;}
  };
  setInterval(ciclo,15000).unref();
}
