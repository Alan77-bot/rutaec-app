import { Router, raw } from "express";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../../lib/prisma.js";
import { autenticar } from "../../middlewares/autenticacion.js";

const router = Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
class ErrorRevision extends Error { constructor(public estado: number, mensaje: string) { super(mensaje); } }
router.use(...autenticar);
router.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  if (!["GET","HEAD","OPTIONS"].includes(req.method) && req.get("origin") !== new URL(process.env.FRONTEND_URL ?? "http://localhost:5173").origin) { res.status(403).json({ error: "Origen no permitido." }); return; }
  next();
});
function personal(s: { rol: string; coopId: string | null }) {
  if (s.rol === "admin") return {};
  if (["oficinista", "cooperativa"].includes(s.rol) && s.coopId) return { cooperativa_id: s.coopId };
  throw new ErrorRevision(403, "La revisión corresponde al oficinista autorizado.");
}
function motivo(x: unknown) { if (typeof x !== "string" || !x.trim() || x.trim().length > 500) throw new ErrorRevision(400,"Indica un motivo de hasta 500 caracteres."); return x.trim(); }
async function revision(s: any, id: string) {
  if (!UUID.test(id)) throw new ErrorRevision(400,"Revisión inválida.");
  const r = await prisma.revisiones.findFirst({ where: { id, ...personal(s) } });
  if (!r) throw new ErrorRevision(404,"Revisión no encontrada.");
  return r;
}
router.get("/", async (req, res) => {
  const s = res.locals.sesion;
  const estado = String(req.query.estado ?? "");
  if (estado && !['PENDIENTE','EN_REVISION','CORRECCION','APROBADA','RECHAZADA'].includes(estado)) throw new ErrorRevision(400,"Estado inválido.");
  const datos = await prisma.revisiones.findMany({ where: { ...personal(s), ...(estado ? { estado } : {}) }, orderBy: { creado_en: "asc" }, take: 200,
    include: { pagos: { include: { comprobantes_pago: { orderBy: { recibido_en: "desc" }, select: { id: true, numero_referencia: true, fecha_operacion: true, importe_declarado: true, archivo_id: true, recibido_en: true } } } }, validaciones_descuento: { include: { pasajeros: true, politicas_descuento: true } }, historial_revisiones: { orderBy: { fecha: "desc" }, select: { actor_id: true, accion: true, motivo: true, fecha: true } } } });
  // BigInt solo aparece en ids de historial que no se seleccionan.
  res.json({ datos });
});
router.get("/:id/archivos/:archivoId", async (req, res) => {
  const r = await revision(res.locals.sesion, String(req.params.id));
  const archivoId = String(req.params.archivoId);
  if (!UUID.test(archivoId) || !r.pago_id) throw new ErrorRevision(404,"Archivo no encontrado.");
  const c = await prisma.comprobantes_pago.findFirst({ where: { pago_id: r.pago_id, archivo_id: archivoId }, include: { archivos: true } });
  if (!c || c.archivos.estado !== 'DISPONIBLE') throw new ErrorRevision(404,"Archivo no encontrado.");
  const base = path.resolve(process.env.COMPROBANTES_DIR ?? path.join(process.cwd(),'storage','comprobantes'));
  const destino = path.resolve(base,c.archivos.objeto_clave);
  if (!destino.startsWith(base+path.sep)) throw new ErrorRevision(404,"Archivo no disponible.");
  res.setHeader('X-Content-Type-Options','nosniff'); res.type(c.archivos.mime_type);
  res.sendFile(destino, e => { if (e && !res.headersSent) res.status(404).json({error:'Archivo no disponible.'}); });
});
router.post("/:id/tomar", async (req, res) => {
  const s = res.locals.sesion; if (s.rol === "cooperativa") throw new ErrorRevision(403,"La aprobación de pagos no está concedida al gerente."); const r = await revision(s, String(req.params.id));
  // La función SQL exige miembro activo y bloquea la fila: solo uno obtiene la revisión.
  await prisma.$transaction(async tx => { await tx.$queryRaw`SELECT set_config('app.usuario_id', ${s.id}, true)`; await tx.$queryRaw`SELECT rutaec.tomar_revision(${r.id}::uuid)`; });
  res.json({ mensaje: "Revisión asignada." });
});
router.post("/:id/liberar", async (req, res) => {
  const s = res.locals.sesion; const r = await revision(s, String(req.params.id)); const razon = motivo(req.body?.motivo);
  if (r.asignado_a !== s.id) throw new ErrorRevision(403,"Solo quien atiende la revisión puede liberarla.");
  await prisma.$transaction(async tx => { await tx.$queryRaw`SELECT set_config('app.usuario_id', ${s.id}, true)`; await tx.$queryRaw`SELECT rutaec.reasignar_revision(${r.id}::uuid, NULL::uuid, ${razon})`; });
  res.json({ mensaje: "Revisión liberada; la compra conserva su estado." });
});
router.post("/:id/reasignar", async (req, res) => {
  const s = res.locals.sesion;
  if (!["admin","cooperativa"].includes(s.rol)) throw new ErrorRevision(403,"La reasignación corresponde al gerente o administrador autorizado.");
  const id = String(req.params.id); if (!UUID.test(id)) throw new ErrorRevision(400,"Revisión inválida.");
  const r = await prisma.revisiones.findFirst({ where: { id, ...(s.rol === 'admin' ? {} : { cooperativa_id: s.coopId ?? '' }) } });
  if (!r) throw new ErrorRevision(404,"Revisión no encontrada.");
  const nuevo = req.body?.usuarioId || null; if (nuevo && !UUID.test(nuevo)) throw new ErrorRevision(400,"Usuario inválido.");
  const razon = motivo(req.body?.motivo);
  await prisma.$transaction(async tx => { await tx.$queryRaw`SELECT set_config('app.usuario_id', ${s.id}, true)`; await tx.$queryRaw`SELECT rutaec.reasignar_revision(${id}::uuid, ${nuevo}::uuid, ${razon})`; });
  res.json({ mensaje: "Revisión reasignada." });
});
router.post("/:id/resolver", async (req, res) => {
  const s = res.locals.sesion; if (s.rol === "cooperativa") throw new ErrorRevision(403,"La aprobación de pagos no está concedida al gerente."); const r = await revision(s, String(req.params.id)); const razon = motivo(req.body?.motivo);
  const decision = req.body?.decision; if (!["APROBAR","CORREGIR","RECHAZAR"].includes(decision)) throw new ErrorRevision(400,"Decisión inválida.");
  if (r.asignado_a !== s.id || r.estado !== "EN_REVISION") throw new ErrorRevision(409,"Debes tomar la revisión antes de resolverla.");
  if (r.tipo === 'PAGO' && decision === 'APROBAR' && (!/^\d+(\.\d{1,2})?$/.test(String(req.body?.importeVerificado)) || Number(req.body.importeVerificado) <= 0 || !req.body?.referencia)) throw new ErrorRevision(400,"Comprueba importe y referencia contra la cuenta bancaria.");
  const resultado = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT set_config('app.usuario_id', ${s.id}, true)`;
    if (r.tipo === "DESCUENTO") { await tx.$queryRaw`SELECT rutaec.resolver_revision_descuento(${r.id}::uuid, ${decision}, ${razon})`; return "Decisión de descuento registrada"; }
    if (decision === 'APROBAR' && r.pago_id) {
      const pago=await tx.pagos.findUniqueOrThrow({where:{id:r.pago_id}});
      const referencia=String(req.body.referencia).trim();
      if(referencia.length<3||referencia.length>40||!pago.cuenta_bancaria_id)throw new ErrorRevision(400,'Referencia bancaria o cuenta inválidas.');
      const proveedor=`BANCO:${pago.cooperativa_id}:${pago.cuenta_bancaria_id}`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${proveedor}:${referencia}`},0))`;
      const repetido=await tx.pagos.findFirst({where:{id:{not:pago.id},OR:[{proveedor,referencia_proveedor:referencia},{cuenta_bancaria_id:pago.cuenta_bancaria_id,estado:{in:['APROBADO','RECIBIDO_INCIDENCIA']},comprobantes_pago:{some:{numero_referencia:referencia}}}]}});
      if(repetido)throw new ErrorRevision(409,'La referencia bancaria ya está registrada en otro pago. Revisa la conciliación.');
      await tx.pagos.update({where:{id:pago.id},data:{proveedor,referencia_proveedor:referencia}});
    }
    const [salida] = await tx.$queryRaw<{ resultado: string }[]>`SELECT rutaec.resolver_revision_pago(${r.id}::uuid, ${decision}, ${razon}, ${decision === 'APROBAR' ? String(req.body.importeVerificado) : null}::numeric, ${req.body?.referencia ?? null}::text) AS resultado`;
    if (salida.resultado === 'CONFIRMADA' && r.pago_id) {
      const pago = await tx.pagos.findUniqueOrThrow({ where: { id: r.pago_id }, select: { compra_id: true } });
      await tx.$queryRaw`SELECT rutaec.emitir_boletos(${pago.compra_id}::uuid)`;
    }
    return salida.resultado;
  });
  res.json({ mensaje: resultado });
});

// Conserva versiones del comprobante; usa el mismo volumen privado de #42.
router.post("/pagos/:pagoId/corregir", raw({ type: 'multipart/form-data', limit: '6mb' }), async (req, res) => {
  const s = res.locals.sesion; const pagoId = String(req.params.pagoId);
  if (!UUID.test(pagoId)) throw new ErrorRevision(400,"Pago inválido.");
  const pago = await prisma.pagos.findFirst({ where: { id: pagoId, ...(s.rol === 'usuario' ? { compras: { comprador_id: s.id } } : personal(s)) }, include: { compras: { select: { comprador_id: true } } } });
  if (!pago) throw new ErrorRevision(404,"Pago no encontrado.");
  if (pago.estado !== 'CORRECCION') throw new ErrorRevision(409,"Este pago no admite corrección.");
  const form = await new Request('http://interno.invalid', { method: 'POST', headers: { 'Content-Type': req.get('content-type') ?? '' }, body: new Blob([new Uint8Array(req.body)]) }).formData();
  const file = form.get('archivo');
  if (!file || typeof file === 'string' || file.size < 1 || file.size > 5 * 1024 * 1024) throw new ErrorRevision(400,"Archivo inválido (máximo 5 MB).");
  const bytes = Buffer.from(await file.arrayBuffer());
  const tipo = bytes.subarray(0,5).toString() === '%PDF-' ? 'application/pdf' : bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png' : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'image/jpeg' : null;
  if (!tipo) throw new ErrorRevision(400,"Solo se permiten JPG, PNG y PDF.");
  const referencia = motivo(form.get('numero_referencia')); const importe = String(form.get('importe_declarado')); const fecha = String(form.get('fecha_operacion'));
  if (!/^\d+(\.\d{1,2})?$/.test(importe) || Number(importe) <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !Number.isFinite(new Date(fecha).getTime()) || new Date(fecha).toISOString().slice(0,10) !== fecha || new Date(fecha) > new Date()) throw new ErrorRevision(400,"Fecha o importe inválidos.");
  const clave = `correcciones/${randomUUID()}.${tipo === 'application/pdf' ? 'pdf' : tipo === 'image/png' ? 'png' : 'jpg'}`;
  const base = path.resolve(process.env.COMPROBANTES_DIR ?? path.join(process.cwd(),'storage','comprobantes'));
  const destino = path.join(base, clave); await mkdir(path.dirname(destino), { recursive: true }); await writeFile(destino, bytes, { flag: 'wx', mode: 0o600 });
  try {
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT set_config('app.usuario_id', ${s.id}, true)`;
      const archivo = await tx.archivos.create({ data: { propietario_id: s.id, cooperativa_id: pago.cooperativa_id, finalidad: 'COMPROBANTE', objeto_clave: clave, nombre_original: file.name.slice(0,200), mime_type: tipo, tamano_bytes: BigInt(bytes.length), sha256: createHash('sha256').update(bytes).digest('hex'), estado: 'DISPONIBLE', privado: true } });
      await tx.$queryRaw`SELECT rutaec.corregir_comprobante(${pagoId}::uuid, ${archivo.id}::uuid, ${referencia}, ${fecha}::date, ${importe}::numeric)`;
    });
  } catch (e) { await unlink(destino).catch(() => undefined); throw e; }
  res.status(201).json({ mensaje: "Corrección recibida. Se conserva el historial de archivos." });
});
router.use((e: unknown, _req: import("express").Request, res: import("express").Response, _next: import("express").NextFunction) => {
  if (e instanceof ErrorRevision) res.status(e.estado).json({ error: e.message });
  else res.status((e as {type?:string}).type === 'entity.too.large' ? 413 : 409).json({ error: "No se pudo completar la revisión. Actualiza el estado; puede estar asignada o resuelta por otro usuario." });
});
export default router;
