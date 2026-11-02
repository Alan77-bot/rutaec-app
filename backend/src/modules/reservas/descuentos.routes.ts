import { documentoPasajero } from './documento.js';
import { Router, raw } from "express";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../../lib/prisma.js";
import { autenticar } from "../../middlewares/autenticacion.js";

const router = Router();
router.use(...autenticar);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
class ErrorDescuento extends Error { constructor(public estado: number, mensaje: string) { super(mensaje); } }
router.use((req, res, next) => {
  res.setHeader('Cache-Control','no-store');
  if (!['GET','HEAD','OPTIONS'].includes(req.method) && req.get('origin') !== new URL(process.env.FRONTEND_URL ?? 'http://localhost:5173').origin) { res.status(403).json({error:'Origen no permitido.'}); return; }
  next();
});
router.get('/politicas', async (_req,res) => {
  const datos = await prisma.politicas_descuento.findMany({ where: { activa:true, vigente_desde:{lte:new Date()}, OR:[{vigente_hasta:null},{vigente_hasta:{gte:new Date()}}] }, orderBy:{codigo:'asc'} });
  res.json({datos});
});
router.get('/mios', async (req,res) => {
  const s=res.locals.sesion;
  const comprador=typeof req.query.compradorId==='string'?req.query.compradorId:s.id;
  if(comprador!==s.id && (s.rol!=='oficinista'||!s.coopId||!UUID.test(comprador))) throw new ErrorDescuento(403,'Consulta no permitida.');
  res.json({datos:await prisma.validaciones_descuento.findMany({ where:{pasajeros:{comprador_id:comprador},...(s.rol==='oficinista'?{cooperativa_id:s.coopId??''}:{})}, include:{pasajeros:true,politicas_descuento:true}, orderBy:{valido_desde:'desc'} })});
});
router.post('/solicitar', raw({type:'multipart/form-data',limit:'6mb'}), async (req,res) => {
  const s=res.locals.sesion;
  if(s.rol !== 'usuario') throw new ErrorDescuento(403,'El titular de la cuenta debe presentar su documento.');
  const f=await new Request('http://interno.invalid',{method:'POST',headers:{'Content-Type':req.get('content-type')??''},body:new Blob([new Uint8Array(req.body)])}).formData();
  const text=(key:string,max=100) => { const v=f.get(key); if(typeof v!=='string'||!v.trim()||v.trim().length>max) throw new ErrorDescuento(400,`Revisa ${key}.`); return v.trim(); };
  const cooperativaId=text('cooperativaId'),politicaId=text('politicaId');
  if(!UUID.test(cooperativaId)||!UUID.test(politicaId)) throw new ErrorDescuento(400,'Cooperativa o política inválida.');
  const nombres=text('nombres'),apellidos=text('apellidos'),nacimiento=text('fechaNacimiento',10);
  let identidad;try{identidad=documentoPasajero({documento:f.get('documento'),tipoDocumento:f.get('tipoDocumento')??'CEDULA',paisDocumento:f.get('paisDocumento')??'EC'});}catch(e){throw new ErrorDescuento(400,e instanceof Error?e.message:'Documento invalido.');}
  const {documento,tipoDocumento,paisDocumento}=identidad;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(nacimiento)||!Number.isFinite(new Date(nacimiento).getTime())||new Date(nacimiento).toISOString().slice(0,10)!==nacimiento||new Date(nacimiento)>new Date()) throw new ErrorDescuento(400,'Cédula o fecha de nacimiento inválida.');
  const file=f.get('archivo');
  if(!file||typeof file==='string'||file.size<1||file.size>5*1024*1024) throw new ErrorDescuento(400,'Adjunta JPG, PNG o PDF de hasta 5 MB.');
  const bytes=Buffer.from(await file.arrayBuffer());
  const tipo=bytes.subarray(0,5).toString()==='%PDF-'?'application/pdf':bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':null;
  if(!tipo) throw new ErrorDescuento(400,'Formato de documento no permitido.');
  const politica=await prisma.politicas_descuento.findFirst({where:{id:politicaId,activa:true,vigente_desde:{lte:new Date()},OR:[{vigente_hasta:null},{vigente_hasta:{gte:new Date()}}]}});
  if(!politica) throw new ErrorDescuento(409,'Política no habilitada. No se aplicará un porcentaje inventado.');
  const clave=`identidad/${randomUUID()}.${tipo==='application/pdf'?'pdf':tipo==='image/png'?'png':'jpg'}`;
  const base=path.resolve(process.env.DOCUMENTOS_DIR??path.join(process.cwd(),'storage','documentos'));
  const destino=path.join(base,clave);await mkdir(path.dirname(destino),{recursive:true});await writeFile(destino,bytes,{flag:'wx',mode:0o600});
  try{
    const id=await prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT set_config('app.usuario_id', ${s.id}, true)`;
      const pasajero=await tx.pasajeros.upsert({where:{comprador_id_pais_documento_tipo_documento_numero_documento:{comprador_id:s.id,pais_documento:paisDocumento,tipo_documento:tipoDocumento,numero_documento:documento}},update:{nombres,apellidos,fecha_nacimiento:new Date(nacimiento)},create:{comprador_id:s.id,nombres,apellidos,fecha_nacimiento:new Date(nacimiento),tipo_documento:tipoDocumento,pais_documento:paisDocumento,numero_documento:documento}});
      const pendiente=await tx.validaciones_descuento.findFirst({where:{pasajero_id:pasajero.id,cooperativa_id:cooperativaId,politica_id:politicaId,estado:'PENDIENTE'}});
      if(pendiente) throw new ErrorDescuento(409,'Ya hay una solicitud pendiente para este pasajero.');
      const archivo=await tx.archivos.create({data:{propietario_id:s.id,cooperativa_id:cooperativaId,finalidad:'IDENTIDAD',objeto_clave:clave,nombre_original:file.name.slice(0,200),mime_type:tipo,tamano_bytes:BigInt(bytes.length),sha256:createHash('sha256').update(bytes).digest('hex'),estado:'DISPONIBLE',privado:true}});
      const doc=await tx.documentos_pasajero.create({data:{pasajero_id:pasajero.id,archivo_id:archivo.id,tipo:tipoDocumento}});
      // La vigencia documental la declara el usuario y el oficinista debe comprobarla.
      const hasta=text('validoHasta',10);
      if(!/^\d{4}-\d{2}-\d{2}$/.test(hasta)||!Number.isFinite(new Date(hasta).getTime())||new Date(hasta)<new Date(new Date().toISOString().slice(0,10))|| (politica.vigente_hasta && new Date(hasta)>politica.vigente_hasta)) throw new ErrorDescuento(400,'Revisa la vigencia; no puede exceder la política.');
      const [r]=await tx.$queryRaw<{id:string}[]>`SELECT rutaec.solicitar_descuento(${pasajero.id}::uuid,${cooperativaId}::uuid,${politicaId}::uuid,${doc.id}::uuid,CURRENT_DATE,${hasta}::date)::text AS id`;
      return r.id;
    });
    res.status(201).json({mensaje:'Documento recibido para revisión. Todavía no se aplica descuento.',id});
  }catch(e){await unlink(destino).catch(()=>undefined);throw e;}
});
router.get('/documentos/:id',async(req,res)=>{
  const id=String(req.params.id);if(!UUID.test(id)) throw new ErrorDescuento(400,'Documento inválido.');
  const s=res.locals.sesion;
  const doc=await prisma.documentos_pasajero.findUnique({where:{id},include:{archivos:true,pasajeros:{select:{comprador_id:true}}}});
  if(!doc||doc.archivos.estado!=='DISPONIBLE'||!(doc.pasajeros.comprador_id===s.id||s.rol==='admin'||(['oficinista','cooperativa'].includes(s.rol)&&s.coopId===doc.archivos.cooperativa_id))) throw new ErrorDescuento(404,'Documento no encontrado.');
  const base=path.resolve(process.env.DOCUMENTOS_DIR??path.join(process.cwd(),'storage','documentos'));const destino=path.resolve(base,doc.archivos.objeto_clave);
  if(!destino.startsWith(base+path.sep)) throw new ErrorDescuento(404,'Archivo no encontrado.');
  res.type(doc.archivos.mime_type);res.setHeader('X-Content-Type-Options','nosniff');
  const stream=createReadStream(destino);stream.on('error',()=>{if(!res.headersSent)res.status(404).end();else res.destroy()});stream.pipe(res);
});
router.use((e:unknown,_req:import('express').Request,res:import('express').Response,_next:import('express').NextFunction)=>{
  res.status(e instanceof ErrorDescuento?e.estado:(e as {type?:string}).type==='entity.too.large'?413:409).json({error:e instanceof ErrorDescuento?e.message:'No se pudo completar la solicitud de descuento.'});
});
export default router;
