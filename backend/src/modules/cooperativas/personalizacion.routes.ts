import { Router, json } from 'express';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink, readFile } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../../lib/prisma.js';
import { autenticar } from '../../middlewares/autenticacion.js';
import { autorizarRoles } from '../../middlewares/autorizacion.js';
import { autorizarCooperativa } from '../../middlewares/cooperativa.js';
import { decodificarImagen, ErrorPersonalizacion, validarPersonalizacion } from './personalizacion.validacion.js';

const router = Router();
const base = path.resolve(process.env.PERSONALIZACION_DIR ?? 'storage/personalizacion');
const urlImagen = (coop: string, id: string) => `/api/cooperativas/${coop}/personalizacion/imagenes/${id}`;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function consultar(id: string) {
  const coop = await prisma.cooperativas.findUnique({ where: { id } });
  if (!coop || coop.activa === false) throw new ErrorPersonalizacion(404, 'La cooperativa no está disponible.');
  const redes = (coop.redes_sociales ?? {}) as Record<string, string>;
  return { ...coop, nombre: coop.nombre_comercial, color: coop.color_primario,
    logo: coop.logo_archivo_id ? urlImagen(id, coop.logo_archivo_id) : '',
    fotografia: redes.portada_archivo_id ? urlImagen(id, redes.portada_archivo_id) : '' };
}

router.get('/:id/personalizacion', async (req, res) => {
  try {
    if (!uuid.test(String(req.params.id))) throw new ErrorPersonalizacion(400, 'Identificador inválido.');
    res.setHeader('Cache-Control', 'no-store');
    res.json({ datos: await consultar(String(req.params.id)) });
  } catch (e) { responderError(e, res); }
});

router.get('/:id/personalizacion/imagenes/:archivoId', async (req, res) => {
  try {
    const id = String(req.params.id), archivoId = String(req.params.archivoId);
    if (!uuid.test(id) || !uuid.test(archivoId)) throw new ErrorPersonalizacion(404, 'Imagen no encontrada.');
    const archivo = await prisma.archivos.findFirst({ where: { id: archivoId, cooperativa_id: id, privado: false, estado: 'DISPONIBLE', finalidad: { in: ['LOGO', 'OTRO'] } } });
    if (!archivo || !/^personalizacion\/[a-f0-9-]+\.(png|jpg|webp)$/.test(archivo.objeto_clave)) throw new ErrorPersonalizacion(404, 'Imagen no encontrada.');
    const datos = await readFile(path.join(base, path.basename(archivo.objeto_clave)));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.type(archivo.mime_type).send(datos);
  } catch (e) { responderError(e, res); }
});

router.patch('/:id/personalizacion', ...autenticar, autorizarRoles('cooperativa'), autorizarCooperativa('id'), json({ limit: '6mb' }), async (req, res) => {
  const creados: string[] = [];
  let confirmado = false;
  try {
    const id = String(req.params.id);
    const datos = validarPersonalizacion(req.body);
    const actual = await consultar(id);
    // Validar todas las imágenes antes de escribir archivos.
    const imagenes = Object.fromEntries(['logo', 'fotografia'].filter(c => datos[c] && datos[c] !== actual[c as 'logo' | 'fotografia']).map(c => [c, decodificarImagen(datos[c]!)]));
    if (imagenes.logo?.tipo === 'webp') throw new ErrorPersonalizacion(400, 'Para el logotipo utiliza PNG o JPG, compatibles con los boletos PDF.');
    await mkdir(base, { recursive: true });
    await prisma.$transaction(async tx => {
      // Serializa los cambios de identidad de una misma cooperativa.
      await tx.$queryRaw`SELECT id FROM rutaec.cooperativas WHERE id = ${id}::uuid FOR UPDATE`;
      const coop = await tx.cooperativas.findUniqueOrThrow({ where: { id } });
      const redes = { ...(coop.redes_sociales as Record<string, string>) };
      let logo = coop.logo_archivo_id;
      for (const campo of ['logo', 'fotografia']) {
        if (!(campo in datos)) continue;
        if (datos[campo] === actual[campo as 'logo' | 'fotografia']) continue;
        let archivoId: string | null = null;
        const imagen = imagenes[campo];
        if (imagen) {
          archivoId = randomUUID();
          const nombre = `${archivoId}.${imagen.extension}`;
          const destino = path.join(base, nombre);
          await writeFile(destino, imagen.datos, { flag: 'wx' });
          creados.push(destino);
          await tx.archivos.create({ data: { id: archivoId, propietario_id: res.locals.sesion.id, cooperativa_id: id, objeto_clave: `personalizacion/${nombre}`, finalidad: campo === 'logo' ? 'LOGO' : 'OTRO', nombre_original: nombre, mime_type: `image/${imagen.tipo}`, tamano_bytes: BigInt(imagen.datos.length), sha256: createHash('sha256').update(imagen.datos).digest('hex'), estado: 'DISPONIBLE', privado: false } });
        }
        if (campo === 'logo') logo = archivoId;
        else if (archivoId) redes.portada_archivo_id = archivoId;
        else delete redes.portada_archivo_id;
      }
      for (const campo of ['facebook', 'instagram', 'whatsapp']) if (campo in datos) redes[campo] = datos[campo]!;
      const contacto = Object.fromEntries(['color_primario', 'color_secundario', 'correo', 'telefono', 'direccion', 'sitio_web'].filter(c => c in datos).map(c => [c, datos[c]]));
      await tx.cooperativas.update({ where: { id }, data: { ...contacto, redes_sociales: redes, logo_archivo_id: logo, actualizado_en: new Date() } });
    });
    confirmado = true;
    res.json({ datos: await consultar(id), mensaje: 'Personalización guardada.' });
  } catch (e) {
    if (!confirmado) await Promise.all(creados.map(f => unlink(f).catch(() => {})));
    responderError(e, res);
  }
});

function responderError(e: unknown, res: import('express').Response) {
  if (e instanceof ErrorPersonalizacion) { res.status(e.estado).json({ error: e.message }); return; }
  console.error('[personalizacion]', e);
  res.status(500).json({ error: 'No se pudo procesar la personalización.' });
}
export default router;
