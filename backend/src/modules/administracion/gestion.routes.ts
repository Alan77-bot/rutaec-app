import { Router, json } from 'express';
import { prisma } from '../../lib/prisma.js';
import { autenticar } from '../../middlewares/autenticacion.js';
import { autorizarRoles } from '../../middlewares/autorizacion.js';
import { decodificarImagen } from '../cooperativas/personalizacion.validacion.js';
import bcrypt from 'bcryptjs';
import { rateLimit } from 'express-rate-limit';

const router = Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
class ErrorGestion extends Error { constructor(public estado: number, mensaje: string) { super(mensaje); } }
const defecto = { nombre: 'RutaEC', color: '#f2a33a', logo: null, soporteTel: '', soporteMail: '', redes: { instagram: '', facebook: '', whatsapp: '' } };
router.use(['/ajustes', '/gestion', '/correo-local'], json({ limit: '1mb' }));
router.use(['/ajustes', '/gestion', '/correo-local'], (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('origin') !== new URL(process.env.FRONTEND_URL || 'http://localhost:5173').origin) { res.status(403).json({ error: 'Origen no permitido.' }); return; }
  next();
});
router.get('/correo-local/estado', (_req,res) => { res.json({ habilitado: process.env.NODE_ENV === 'development' && (!process.env.SMTP_USER || !process.env.SMTP_PASS) }); });
router.post('/correo-local', rateLimit({ windowMs:60000,limit:10,legacyHeaders:false,standardHeaders:true }), async(req,res) => {
  if (process.env.NODE_ENV !== 'development' || (process.env.SMTP_USER && process.env.SMTP_PASS)) throw new ErrorGestion(404,'La bandeja local no está habilitada.');
  const b = objeto(req.body), correo=texto(b.correo,'correo',true,254), clave=texto(b.clave,'contraseña',true,72);
  const usuario = await prisma.usuarios.findFirst({where:{correo:{equals:correo,mode:'insensitive'},activo:true},select:{password_hash:true,correo:true}});
  if (!usuario || !await bcrypt.compare(clave,usuario.password_hash)) throw new ErrorGestion(401,'Credenciales incorrectas.');
  const datos = await prisma.$queryRaw`SELECT id,asunto,texto,creado_en FROM rutaec.correos_desarrollo WHERE lower(destinatario)=lower(${usuario.correo}) ORDER BY creado_en DESC LIMIT 15`;
  res.json({datos});
});
function objeto(x: unknown): Record<string, unknown> {
  if (!x || typeof x !== 'object' || Array.isArray(x)) throw new ErrorGestion(400, 'Datos inválidos.');
  return x as Record<string, unknown>;
}
function texto(x: unknown, campo: string, obligatorio = true, max = 200) {
  if (typeof x !== 'string' || x.trim().length > max || (obligatorio && !x.trim())) throw new ErrorGestion(400, `Revisa ${campo}.`);
  return x.trim();
}
function fecha(x: unknown, campo: string, opcional = false): Date | null {
  if (opcional && (x === '' || x === null || x === undefined)) return null;
  if (typeof x !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x) || !Number.isFinite(Date.parse(x)) || new Date(x).toISOString().slice(0,10) !== x) throw new ErrorGestion(400, `Revisa ${campo}.`);
  return new Date(x);
}
router.get('/ajustes', async (_req, res) => {
  const filas = await prisma.$queryRaw<{ valor: typeof defecto }[]>`SELECT valor FROM rutaec.configuracion_aplicacion WHERE clave='general'`;
  res.json(filas[0]?.valor || defecto);
});
router.put('/ajustes', ...autenticar, autorizarRoles('admin'), async (req, res) => {
  const b = objeto(req.body), redes = objeto(b.redes);
  const color = texto(b.color, 'color');
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new ErrorGestion(400, 'Color inválido.');
  let logo: string | null = null;
  if (b.logo) { logo = texto(b.logo, 'logo', true, 750000); if (decodificarImagen(logo).datos.length > 500 * 1024) throw new ErrorGestion(400, 'El logo debe pesar hasta 500 KB.'); }
  const datos = { nombre: texto(b.nombre, 'nombre', true, 80), color, logo, soporteTel: texto(b.soporteTel, 'teléfono', false, 30), soporteMail: texto(b.soporteMail, 'correo', false, 254), redes: { instagram: texto(redes.instagram, 'Instagram', false), facebook: texto(redes.facebook, 'Facebook', false), whatsapp: texto(redes.whatsapp, 'WhatsApp', false, 30) } };
  if (datos.soporteMail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.soporteMail)) throw new ErrorGestion(400, 'Correo inválido.');
  for (const valor of [datos.redes.instagram, datos.redes.facebook]) if (valor) { try { if (!['http:', 'https:'].includes(new URL(valor).protocol)) throw new Error(); } catch { throw new ErrorGestion(400, 'Los enlaces deben usar HTTP o HTTPS.'); } }
  await prisma.$executeRaw`INSERT INTO rutaec.configuracion_aplicacion(clave,valor) VALUES('general',${JSON.stringify(datos)}::jsonb) ON CONFLICT(clave) DO UPDATE SET valor=EXCLUDED.valor,actualizado_en=clock_timestamp()`;
  res.json(datos);
});
router.use('/gestion', ...autenticar, autorizarRoles('admin', 'cooperativa'));
router.get('/gestion/:recurso', async (req, res) => {
  const s = res.locals.sesion;
  const coop = s.rol === 'cooperativa' ? s.coopId : req.query.cooperativa_id;
  if (s.rol === 'cooperativa' && !coop) throw new ErrorGestion(403, 'Cooperativa no asignada.');
  if (coop && (typeof coop !== 'string' || !UUID.test(coop))) throw new ErrorGestion(400, 'Cooperativa inválida.');
  const where = coop ? { cooperativa_id: String(coop) } : {};
  switch (req.params.recurso) {
    case 'terminales': if (s.rol !== 'admin') throw new ErrorGestion(403,'Solo el administrador gestiona terminales.'); res.json({ datos: await prisma.terminales.findMany({include:{ciudades:true},orderBy:{nombre:'asc'}}) }); return;
    case 'grupos': res.json({ datos: await prisma.grupos_buses.findMany({where,orderBy:{nombre:'asc'}}) }); return;
    case 'resoluciones': res.json({ datos: await prisma.resoluciones.findMany({ where, orderBy: { vigente_desde: 'desc' } }) }); return;
    case 'cuentas': res.json({ datos: await prisma.cuentas_bancarias.findMany({ where, orderBy: { banco: 'asc' } }) }); return;
    case 'politicas': if (s.rol !== 'admin') throw new ErrorGestion(403, 'Las políticas se administran en el panel general.'); res.json({ datos: await prisma.politicas_descuento.findMany({ orderBy: [{ codigo: 'asc' }, { version: 'desc' }] }) }); return;
    default: throw new ErrorGestion(404, 'Gestión no disponible.');
  }
});
router.post('/gestion/:recurso', guardar);
router.put('/gestion/:recurso/:id', guardar);
async function guardar(req: import('express').Request, res: import('express').Response) {
  const s = res.locals.sesion, b = objeto(req.body), id = req.params.id ? String(req.params.id) : null;
  if (id && !UUID.test(id)) throw new ErrorGestion(400, 'Identificador inválido.');
  const recurso = String(req.params.recurso);
  if (!['cuentas','resoluciones','politicas','terminales','grupos'].includes(recurso)) throw new ErrorGestion(404, 'Gestión no disponible.');
  if (recurso === 'terminales') {
    if (s.rol !== 'admin') throw new ErrorGestion(403,'Solo el administrador gestiona terminales.');
    const ciudad = texto(b.ciudad_id,'ciudad');
    if (!UUID.test(ciudad) || !await prisma.ciudades.findUnique({where:{id:ciudad}})) throw new ErrorGestion(400,'Selecciona una ciudad del catálogo.');
    const data={ciudad_id:ciudad,nombre:texto(b.nombre,'nombre'),direccion:texto(b.direccion,'dirección')};
    if (id) {
      if (!await prisma.terminales.findUnique({where:{id}})) throw new ErrorGestion(404,'Terminal no encontrada.');
      if (await prisma.paradas_ruta.count({where:{terminal_id:id}}) || await prisma.paradas_viaje.count({where:{terminal_id:id}})) throw new ErrorGestion(409,'La terminal ya tiene recorridos asociados. Registra una terminal nueva para conservar el historial.');
      res.json({datos:await prisma.terminales.update({where:{id},data})});
    } else res.status(201).json({datos:await prisma.terminales.create({data})});
    return;
  }
  if (recurso === 'politicas' && s.rol !== 'admin') throw new ErrorGestion(403, 'Solo el administrador gestiona políticas.');
  const coop = s.rol === 'cooperativa' ? s.coopId : b.cooperativa_id;
  if (recurso !== 'politicas' && (typeof coop !== 'string' || !UUID.test(coop))) throw new ErrorGestion(400, 'Selecciona una cooperativa.');
  if (recurso === 'grupos') {
    if (!['LARGA_DISTANCIA','CANTONAL','LOCAL'].includes(String(b.tipo))) throw new ErrorGestion(400,'Tipo de grupo inválido.');
    const data={nombre:texto(b.nombre,'nombre'),tipo:String(b.tipo),activo:b.activo!==false};
    if (id) {
      if (!await prisma.grupos_buses.findFirst({where:{id,cooperativa_id:String(coop)}})) throw new ErrorGestion(404,'Grupo no encontrado.');
      res.json({datos:await prisma.grupos_buses.update({where:{id},data})});
    } else res.status(201).json({datos:await prisma.grupos_buses.create({data:{...data,cooperativa_id:String(coop)}})});
    return;
  }
  if (recurso === 'cuentas') {
    if (!['AHORROS','CORRIENTE'].includes(String(b.tipo))) throw new ErrorGestion(400, 'Tipo de cuenta inválido.');
    const data = { banco: texto(b.banco,'banco'), tipo: String(b.tipo), numero: texto(b.numero,'número',true,40), titular: texto(b.titular,'titular'), activa: b.activa !== false };
    if (id) { const actual = await prisma.cuentas_bancarias.findFirst({ where: { id, cooperativa_id: String(coop) } }); if (!actual) throw new ErrorGestion(404,'Cuenta no encontrada.'); res.json({ datos: await prisma.cuentas_bancarias.update({ where: { id }, data }) }); }
    else res.status(201).json({ datos: await prisma.cuentas_bancarias.create({ data: { ...data, cooperativa_id: String(coop) } }) });
    return;
  }
  const desde = fecha(b.vigente_desde,'vigencia inicial')!, hasta = fecha(b.vigente_hasta,'vigencia final',true);
  if (hasta && hasta < desde) throw new ErrorGestion(400,'La vigencia final no puede ser anterior a la inicial.');
  if (recurso === 'resoluciones') {
    const data = { numero: texto(b.numero,'número'), autoridad: texto(b.autoridad,'autoridad'), fecha_emision: fecha(b.fecha_emision,'emisión')!, vigente_desde: desde, vigente_hasta: hasta };
    if (data.fecha_emision > desde) throw new ErrorGestion(400,'La emisión no puede ser posterior al inicio de vigencia.');
    if (id) { if (!await prisma.resoluciones.findFirst({ where: { id, cooperativa_id: String(coop) } })) throw new ErrorGestion(404,'Resolución no encontrada.'); res.json({ datos: await prisma.resoluciones.update({ where: { id }, data }) }); }
    else res.status(201).json({ datos: await prisma.resoluciones.create({ data: { ...data, cooperativa_id: String(coop) } }) });
    return;
  }
  const porcentaje = Number(b.porcentaje), version = Number(b.version);
  const edad = (v: unknown) => v === '' || v === null || v === undefined ? null : Number(v);
  const min = edad(b.edad_minima), max = edad(b.edad_maxima);
  if (!(porcentaje > 0 && porcentaje < 100) || !Number.isInteger(version) || version < 1 || [min,max].some(v => v !== null && (!Number.isInteger(v) || v < 0 || v > 130)) || (min !== null && max !== null && max < min)) throw new ErrorGestion(400,'Revisa porcentaje, versión y edades.');
  const data = { codigo: texto(b.codigo,'código',true,30).toUpperCase(), version, descripcion: texto(b.descripcion,'descripción'), porcentaje, edad_minima: min, edad_maxima: max, documento_requerido: texto(b.documento_requerido,'documento requerido'), fuente_normativa: texto(b.fuente_normativa,'fuente'), vigente_desde: desde, vigente_hasta: hasta, activa: b.activa !== false };
  if (id) {
    if (!await prisma.politicas_descuento.findUnique({ where: { id } })) throw new ErrorGestion(404,'Política no encontrada.');
    if (await prisma.validaciones_descuento.count({ where: { politica_id: id } })) throw new ErrorGestion(409,'La política ya está en uso. Crea una nueva versión para conservar las validaciones anteriores.');
    res.json({ datos: await prisma.politicas_descuento.update({ where: { id }, data }) });
  } else res.status(201).json({ datos: await prisma.politicas_descuento.create({ data }) });
}
router.use((e: unknown, _req: import('express').Request, res: import('express').Response, _next: import('express').NextFunction) => {
  const codigo = (e as { code?: string }).code;
  const estado = e instanceof ErrorGestion ? e.estado : codigo === 'P2002' ? 409 : 500;
  if (estado === 500) console.error('[gestion]', e);
  res.status(estado).json({ error: e instanceof ErrorGestion ? e.message : codigo === 'P2002' ? 'Ya existe un registro con esos datos.' : 'No se pudo guardar la configuración.' });
});
export default router;
