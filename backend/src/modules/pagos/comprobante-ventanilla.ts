import { bloquearOcupacionCompra } from './ocupacion-compra.js';
import { Router, raw } from 'express';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../../lib/prisma.js';

const router = Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
class ErrorComprobante extends Error { constructor(public estado: number, mensaje: string) { super(mensaje); } }

// El router padre exige sesión de oficinista. La función SQL existente vuelve a comprobar su cooperativa.
router.post('/comprobante', raw({ type: 'multipart/form-data', limit: '6mb' }), async (req, res) => {
  if (req.get('origin') !== new URL(process.env.FRONTEND_URL ?? 'http://localhost:5173').origin) throw new ErrorComprobante(403, 'Origen no permitido.');
  const s = res.locals.sesion;
  if (!s.coopId) throw new ErrorComprobante(403, 'No tienes cooperativa asignada.');
  const form = await new Request('http://interno.invalid', { method: 'POST', headers: { 'Content-Type': req.get('content-type') ?? '' }, body: new Blob([new Uint8Array(req.body)]) }).formData();
  const campo = (nombre: string) => String(form.get(nombre) ?? '').trim();
  const compraId = campo('compra_id'), cuentaId = campo('cuenta_bancaria_id'), idempotencia = campo('clave_idempotencia');
  const metodo = campo('metodo'), referencia = campo('numero_referencia'), fecha = campo('fecha_operacion'), importe = campo('importe_declarado');
  if (![compraId, cuentaId, idempotencia].every(x => UUID.test(x)) || !['DEPOSITO', 'TRANSFERENCIA'].includes(metodo)) throw new ErrorComprobante(400, 'Compra, cuenta o método inválidos.');
  if (referencia.length < 3 || referencia.length > 40 || !/^\d+(\.\d{1,2})?$/.test(importe) || Number(importe) <= 0 || Number(importe) > 99999999) throw new ErrorComprobante(400, 'Referencia o importe inválidos.');
  const dia = new Date(fecha);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !Number.isFinite(dia.getTime()) || dia.toISOString().slice(0, 10) !== fecha || dia > new Date()) throw new ErrorComprobante(400, 'Fecha de operación inválida.');
  const compra = await prisma.compras.findFirst({ where: { id: compraId, cooperativa_id: s.coopId }, select: { id: true, cooperativa_id: true,canal:true } });
  if (!compra) throw new ErrorComprobante(404, 'Compra no encontrada en tu cooperativa.');
  const file = form.get('archivo');
  if (!file || typeof file === 'string' || file.size < 1 || file.size > 5 * 1024 * 1024) throw new ErrorComprobante(400, 'Adjunta un comprobante de hasta 5 MB.');
  const bytes = Buffer.from(await file.arrayBuffer());
  const tipo = bytes.subarray(0, 5).toString() === '%PDF-' ? 'application/pdf' : bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png' : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'image/jpeg' : null;
  if (!tipo) throw new ErrorComprobante(400, 'Solo se permiten JPG, PNG y PDF.');
  const clave = `ventanilla/${randomUUID()}.${tipo === 'application/pdf' ? 'pdf' : tipo === 'image/png' ? 'png' : 'jpg'}`;
  const destino = path.resolve(process.env.COMPROBANTES_DIR ?? path.join(process.cwd(), 'storage', 'comprobantes'), clave);
  await mkdir(path.dirname(destino), { recursive: true });
  await writeFile(destino, bytes, { flag: 'wx', mode: 0o600 });
  try {
    const resultado = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${idempotencia},0))`;
      await tx.$queryRaw`SELECT set_config('app.usuario_id', ${s.id}, true)`;
      const previo = await tx.pagos.findUnique({ where: { clave_idempotencia: idempotencia } });
      if (previo) {
        if (previo.compra_id !== compraId || previo.cuenta_bancaria_id !== cuentaId || previo.metodo !== metodo || previo.importe.toString() !== Number(importe).toString()) throw new ErrorComprobante(409, 'La solicitud ya se utilizó con otros datos.');
        return { pagoId: previo.id, usado: false };
      }
      const archivo = await tx.archivos.create({ data: { propietario_id: s.id, cooperativa_id: compra.cooperativa_id, finalidad: 'COMPROBANTE', objeto_clave: clave, nombre_original: file.name.slice(0,120), mime_type: tipo, tamano_bytes: BigInt(bytes.length), sha256: createHash('sha256').update(bytes).digest('hex'), estado: 'DISPONIBLE', privado: true } });
      const [fila] = await tx.$queryRaw<{ id: string | null }[]>`SELECT rutaec.recibir_comprobante(${compraId}::uuid, ${cuentaId}::uuid, ${metodo}, ${archivo.id}::uuid, ${referencia}, ${fecha}::date, ${importe}::numeric, ${idempotencia}::uuid) AS id`;
      if (!fila?.id) { await tx.archivos.update({ where: { id: archivo.id }, data: { estado: 'ELIMINADO', eliminado_en: new Date() } }); return { pagoId: null, usado: false }; }
      if (form.get('confirmado') === 'true') {
        if(compra.canal !== 'VENTANILLA') throw new ErrorComprobante(403,'Solo las ventas presenciales se confirman desde caja.');
        if(!await bloquearOcupacionCompra(tx,compraId)) throw new ErrorComprobante(409,'Los asientos ya no están disponibles.');
        const pago=await tx.pagos.findUniqueOrThrow({where:{id:fila.id}});
        if(Number(pago.importe)!==Number(importe)) throw new ErrorComprobante(400,'El importe debe coincidir con el total de la venta.');
        const proveedor=`BANCO:${compra.cooperativa_id}:${cuentaId}`;
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${proveedor+':'+referencia},0))::text`;
        if(await tx.pagos.findFirst({where:{id:{not:fila.id},proveedor,referencia_proveedor:referencia}})) throw new ErrorComprobante(409,'Referencia bancaria ya utilizada.');
        await tx.pagos.update({where:{id:fila.id},data:{proveedor,referencia_proveedor:referencia}});
        const revision=await tx.revisiones.findUniqueOrThrow({where:{pago_id:fila.id}});
        await tx.$executeRaw`SELECT rutaec.tomar_revision(${revision.id}::uuid)`;
        const [salida]=await tx.$queryRaw<{resultado:string}[]>`SELECT rutaec.resolver_revision_pago(${revision.id}::uuid,'APROBAR','Pago comprobado presencialmente en caja',${importe}::numeric,${referencia}) AS resultado`;
        if(salida.resultado!=='CONFIRMADA') throw new ErrorComprobante(409,'El pago necesita conciliación antes de emitir.');
        await tx.$executeRaw`SELECT rutaec.emitir_boletos(${compraId}::uuid)`;
      }
      return { pagoId: fila.id, usado: true };
    });
    if (!resultado.usado) await unlink(destino);
    if (!resultado.pagoId) { res.status(409).json({ error: 'La reserva venció. El pago tardío debe tramitarse como incidencia.' }); return; }
    res.status(resultado.usado ? 201 : 200).json({ datos: { pago_id: resultado.pagoId }, mensaje: 'Comprobante recibido para revisión.' });
  } catch (e) { await unlink(destino).catch(() => undefined); throw e; }
});
router.use((e: unknown, _req: import('express').Request, res: import('express').Response, _next: import('express').NextFunction) => {
  res.status(e instanceof ErrorComprobante ? e.estado : (e as { type?: string }).type === 'entity.too.large' ? 413 : 409).json({ error: e instanceof ErrorComprobante ? e.message : 'No se pudo recibir el comprobante. Actualiza la reserva y revisa sus datos.' });
});
export default router;
