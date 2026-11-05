import { Router, raw } from 'express';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { autenticar } from '../../middlewares/autenticacion.js';
import { autorizarRoles } from '../../middlewares/autorizacion.js';
import { decodificarImagen } from '../cooperativas/personalizacion.validacion.js';
const router=Router(), uuid=/^[0-9a-f-]{36}$/i;
const base=path.resolve(process.env.PERSONALIZACION_DIR || 'storage/personalizacion','buses');
router.get('/:archivo',async(req,res)=>{
  const archivo=String(req.params.archivo);
  if(!/^[0-9a-f-]{36}\.(png|jpg|webp)$/i.test(archivo)){res.sendStatus(404);return;}
  try{const datos=await readFile(path.join(base,archivo));res.setHeader('X-Content-Type-Options','nosniff');res.type(path.extname(archivo)).send(datos);}catch{res.sendStatus(404);}
});
router.post('/:id',...autenticar,autorizarRoles('cooperativa'),raw({type:'multipart/form-data',limit:'3mb'}),async(req,res)=>{
  const id=String(req.params.id),s=res.locals.sesion;
  if(req.get('origin')!==new URL(process.env.FRONTEND_URL||'http://localhost:5173').origin){res.sendStatus(403);return;}
  if(!uuid.test(id)){res.status(400).json({error:'Bus inválido.'});return;}
  if(!await prisma.buses.findFirst({where:{id,cooperativa_id:s.coopId??''}})){res.status(404).json({error:'Bus no encontrado en tu cooperativa.'});return;}
  const form=await new Request('http://interno.invalid',{method:'POST',headers:{'Content-Type':req.get('content-type')||''},body:new Blob([new Uint8Array(req.body)])}).formData();
  const archivo=form.get('archivo');
  if(!archivo||typeof archivo==='string'||archivo.size>2*1024*1024){res.status(400).json({error:'Selecciona una imagen PNG, JPG o WebP de hasta 2 MB.'});return;}
  const bytes=Buffer.from(await archivo.arrayBuffer());
  const imagen=decodificarImagen(`data:${archivo.type};base64,${bytes.toString('base64')}`);
  const extension=archivo.type==='image/png'?'png':archivo.type==='image/webp'?'webp':'jpg';
  const nombre=`${randomUUID()}.${extension}`;await mkdir(base,{recursive:true});await writeFile(path.join(base,nombre),imagen.datos,{flag:'wx'});
  const url=`/api/imagenes-buses/${nombre}`;
  await prisma.buses.update({where:{id},data:{imagen_url:url}});res.status(201).json({datos:{imagen_url:url}});
});
router.use((e:unknown,_req:import('express').Request,res:import('express').Response,_next:import('express').NextFunction)=>res.status(400).json({error:e instanceof Error?e.message:'No se pudo cargar la imagen.'}));
export default router;
