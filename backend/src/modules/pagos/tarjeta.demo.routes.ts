import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { prisma } from "../../lib/prisma.js";
import { autenticar } from "../../middlewares/autenticacion.js";
import { bloquearOcupacionCompra } from './ocupacion-compra.js';

const router = Router();
router.post('/tarjeta-demo', ...autenticar, rateLimit({ windowMs: 60000, limit: 10, legacyHeaders: false, standardHeaders: true }), async (req, res) => {
  if (process.env.NODE_ENV === 'production' || process.env.TARJETA_MODO_DEMO !== 'true') { res.status(503).json({ error: 'La tarjeta de demostración no está habilitada. No hay pasarela de cobro real.' }); return; }
  if (req.get('origin') !== new URL(process.env.FRONTEND_URL ?? 'http://localhost:5173').origin) { res.status(403).json({ error: 'Origen no permitido.' }); return; }
  const { compraId, claveIdempotencia, numero, titular, vencimiento, codigoSeguridad, resultado } = req.body ?? {};
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (typeof compraId !== 'string' || !uuid.test(compraId) || typeof claveIdempotencia !== 'string' || !uuid.test(claveIdempotencia) || typeof numero !== 'string' || !/^\d{13,19}$/.test(numero) || typeof titular !== 'string' || titular.trim().length < 3 || titular.length > 100 || typeof vencimiento !== 'string' || !/^(0[1-9]|1[0-2])\/\d{2}$/.test(vencimiento) || typeof codigoSeguridad !== 'string' || !/^\d{3,4}$/.test(codigoSeguridad) || !['APROBADO','RECHAZADO'].includes(resultado)) { res.status(400).json({ error: 'Revisa los datos de la tarjeta de prueba.' }); return; }
  const [mes, anio] = vencimiento.split('/').map(Number);
  if (new Date(2000 + anio, mes, 1) <= new Date()) { res.status(400).json({ error: 'La tarjeta de prueba está vencida.' }); return; }
  let suma = 0, doble = false;
  for (let i = numero.length - 1; i >= 0; i--) { let n = Number(numero[i]); if (doble) { n *= 2; if (n > 9) n -= 9; } suma += n; doble = !doble; }
  if (suma % 10 !== 0) { res.status(400).json({ error: 'El número de prueba no tiene un formato válido.' }); return; }
  const s = res.locals.sesion;
  if (!['usuario','oficinista'].includes(s.rol)) { res.status(403).json({ error: 'Rol no autorizado.' }); return; }
  const compra = await prisma.compras.findFirst({ where: { id: compraId, ...(s.rol === 'usuario' ? { comprador_id: s.id } : { cooperativa_id: s.coopId ?? '' }) } });
  if (!compra) { res.status(404).json({ error: 'Compra no encontrada.' }); return; }
  // No se persiste número, titular, vencimiento ni CVV. No se simula una firma
  // de pasarela: esta transición es exclusiva del modo de demostración local.
  const pago = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT set_config('app.usuario_id', ${s.id}, true)`;
    if(!await bloquearOcupacionCompra(tx,compraId))throw new Error('El asiento ya no está disponible. Actualiza tu reserva.');
    const [fila] = await tx.$queryRaw<{ id: string }[]>`SELECT rutaec.crear_intento_tarjeta(${compraId}::uuid, 'DEMO_SIN_COBRO', ${claveIdempotencia}::uuid)::text AS id`;
    const actual = await tx.pagos.findUniqueOrThrow({ where: { id: fila.id } });
    if (actual.estado !== 'PENDIENTE') return actual;
    if (resultado === 'RECHAZADO') return tx.pagos.update({ where: { id: actual.id }, data: { estado: 'FALLIDO', motivo: 'RECHAZO SIMULADO; NO HUBO COBRO' } });
    const confirmado = await tx.pagos.update({ where: { id: actual.id }, data: { estado: 'APROBADO', importe_recibido: compra.total, moneda_recibida: compra.moneda, recibido_en: new Date(), aprobado_en: new Date(), motivo: 'DEMOSTRACION; SIN COBRO REAL' } });
    await tx.compras.update({ where: { id: compraId }, data: { estado: 'CONFIRMADA', confirmada_en: new Date() } });
    await tx.$executeRaw`SELECT rutaec.emitir_boletos(${compraId}::uuid)`;
    await tx.$executeRaw`UPDATE rutaec.boletos SET datos_emision = datos_emision || '{"modo_demo":true}'::jsonb WHERE compra_id = ${compraId}::uuid`;
    return confirmado;
  });
  res.json({ mensaje: pago.estado === 'APROBADO' ? 'Pago de demostración aprobado. No se realizó ningún cobro.' : 'Rechazo de demostración. No se realizó ningún cobro.', modoDemo: true, estado: pago.estado });
});
router.use((_e: unknown, _req: import('express').Request, res: import('express').Response, _next: import('express').NextFunction) => { res.status(409).json({ error: 'No se pudo procesar la demostración. Revisa la reserva y su vencimiento.' }); });
export default router;
