import { prisma } from '../../lib/prisma.js';
import type { Prisma } from '../../generated/prisma/client.js';

const inicioProceso=new Date();
function positivo(nombre:string,defecto:number){const n=Number(process.env[nombre]??defecto);return Number.isFinite(n)&&n>0&&n<=8784?n:defecto;}
export const politicaPlazos={revisionHoras:positivo('REVISION_PLAZO_HORAS',24),correccionHoras:positivo('CORRECCION_PLAZO_HORAS',24),asignacionMinutos:positivo('REVISION_ASIGNACION_MINUTOS',30)};
type Registro={id:string;creado_en:Date;tomado_en:Date|null;historial_revisiones:{accion:string;fecha:Date}[]};
type Politica=typeof politicaPlazos & {revisionVenceEn:string};
export function clavePolitica(id:string){return `revision-plazos:${id}`;}
export function plazosRevision(r:Registro,datos?:unknown){
  const guardada=datos as Politica|undefined;
  const politica=guardada?.revisionVenceEn?guardada:{...politicaPlazos,revisionVenceEn:new Date(Math.max(r.creado_en.getTime(),inicioProceso.getTime())+politicaPlazos.revisionHoras*3600000).toISOString()};
  const corregir=r.historial_revisiones.filter(h=>h.accion==='CORREGIR').sort((a,b)=>b.fecha.getTime()-a.fecha.getTime())[0];
  return {...politica,correccionVenceEn:corregir?new Date(corregir.fecha.getTime()+politica.correccionHoras*3600000).toISOString():null,asignacionVenceEn:r.tomado_en?new Date(r.tomado_en.getTime()+politica.asignacionMinutos*60000).toISOString():null};
}
async function guardarPolitica(tx:Prisma.TransactionClient,r:Registro,coop:string){
  const clave=clavePolitica(r.id);
  const politica=await tx.eventos_salida.upsert({where:{clave_deduplicacion:clave},update:{},create:{tipo:'REVISION_PLAZOS',entidad_id:r.id,cooperativa_id:coop,clave_deduplicacion:clave,datos:plazosRevision(r),estado:'COMPLETADO',procesado_en:new Date()}});
  return plazosRevision(r,politica.datos);
}

// Se ejecuta al tomar/decidir y en segundo plano. No precisa nuevas columnas ni funciones SQL.
export async function aplicarPlazosRevision(id:string){
  return prisma.$transaction(async tx=>{
    const inicial=await tx.revisiones.findUnique({where:{id},include:{pagos:{select:{compra_id:true}}}});
    if(!inicial)return;
    // Mismo orden que resolver_revision_pago: compra antes de revisión.
    if(inicial.pagos)await tx.$queryRaw`SELECT id FROM rutaec.compras WHERE id=${inicial.pagos.compra_id}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM rutaec.revisiones WHERE id=${id}::uuid FOR UPDATE`;
    const r=await tx.revisiones.findUniqueOrThrow({where:{id},include:{historial_revisiones:true,pagos:true}});
    if(['APROBADA','RECHAZADA'].includes(r.estado))return;
    const plazos=await guardarPolitica(tx,r,r.cooperativa_id),ahora=new Date();
    const validacion=r.validacion_id?await tx.validaciones_descuento.findUnique({where:{id:r.validacion_id},select:{estado:true}}):null;
    const correccion=r.pagos?.estado==='CORRECCION'||validacion?.estado==='CORRECCION';
    const vencimiento=correccion?plazos.correccionVenceEn:plazos.revisionVenceEn;
    const claveVencida=`revision-plazo-vencido:${r.id}:${vencimiento}`;
    const vencida=vencimiento&&new Date(vencimiento)<=ahora;
    if(vencida&&!await tx.eventos_salida.findUnique({where:{clave_deduplicacion:claveVencida}})){
      const motivo=correccion?'Venció el plazo configurado de corrección.':'Venció el plazo de atención de la revisión.';
      if(r.pagos){
        const c=await tx.compras.findUniqueOrThrow({where:{id:r.pagos.compra_id}});
        // No afirmar que entró dinero ni cancelar un cobro. Se libera la reserva y se concilia manualmente.
        if(['RESERVADA','EN_REVISION'].includes(c.estado))await tx.compras.update({where:{id:c.id},data:{estado:'INCIDENCIA',motivo:`${motivo} Continúa por incidencia; el asiento deja de estar retenido.`,finalizada_en:ahora}});
        await tx.incidencias.create({data:{compra_id:c.id,cooperativa_id:r.cooperativa_id,pago_id:r.pago_id,tipo:'OTRO',descripcion:`${motivo} Comprobar el banco y ofrecer nueva reserva con aceptación o gestionar devolución. No se confirma un asiento por esta incidencia.`}});
        await tx.$queryRaw`SELECT rutaec.encolar_evento('REVISION_PLAZO_VENCIDO',${r.id}::uuid,${r.cooperativa_id}::uuid,${claveVencida},${JSON.stringify({compra_id:c.id,motivo})}::jsonb)`;
      }else{
        await tx.$queryRaw`SELECT rutaec.encolar_evento('DESCUENTO_PLAZO_VENCIDO',${r.validacion_id}::uuid,${r.cooperativa_id}::uuid,${claveVencida},${JSON.stringify({motivo})}::jsonb)`;
      }
      await tx.revisiones.update({where:{id},data:{alertado_en:ahora}});
    }
    const persona=r.asignado_a?await tx.miembros_cooperativa.findFirst({where:{cooperativa_id:r.cooperativa_id,usuario_id:r.asignado_a,activo:true,usuarios:{activo:true}}}):null;
    const abandono=r.asignado_a&&(!persona||(plazos.asignacionVenceEn&&new Date(plazos.asignacionVenceEn)<=ahora));
    if(abandono){
      await tx.revisiones.update({where:{id},data:{asignado_a:null,tomado_en:null,estado:correccion?'CORRECCION':'PENDIENTE'}});
      await tx.$queryRaw`SELECT rutaec.encolar_evento('REVISION_ASIGNACION_RECUPERADA',${id}::uuid,${r.cooperativa_id}::uuid,${`revision-liberada:${id}:${r.tomado_en?.toISOString()??r.asignado_a}`},${JSON.stringify({revision_id:id,revisor_anterior:r.asignado_a,actor:'SISTEMA',motivo:'Asignación vencida o personal desactivado. Se libera solo la asignación; no se rechaza el pago.'})}::jsonb)`;
    }
    return plazos;
  });
}
export function iniciarPlazosRevisiones(){
  let ocupado=false,cursor:string|null=null;
  const ciclo=async()=>{if(ocupado)return;ocupado=true;try{
    const filas=await prisma.revisiones.findMany({where:{estado:{in:['PENDIENTE','EN_REVISION','CORRECCION']},...(cursor?{id:{gt:cursor}}:{})},select:{id:true},orderBy:{id:'asc'},take:200});
    for(const r of filas){await aplicarPlazosRevision(r.id);cursor=r.id;}if(filas.length<200)cursor=null;
  }catch{console.error('[revisiones] No se pudieron procesar los plazos; se reintentará.');}finally{ocupado=false;}};
  void ciclo();setInterval(ciclo,60000).unref();
}
