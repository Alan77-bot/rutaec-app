import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { autenticar } from '../../middlewares/autenticacion.js';
import { autorizarRoles } from '../../middlewares/autorizacion.js';
import { fechasDeOperacion, hoyEn } from './horarios.programacion.js';
import { validarGeneracion } from './horarios.validacion.js';
import { ErrorHorarios } from './horarios.service.js';
import { listarBuses, listarViajes, programarViajes } from './horarios.viajes.js';

const router = Router();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
router.use('/planificacion', ...autenticar, autorizarRoles('cooperativa'));
router.get('/planificacion', async (req, res) => {
  const coop = res.locals.sesion.coopId;
  if (!coop) throw new ErrorHorarios(403,'Cooperativa no asignada.');
  const desde = String(req.query.desde || hoyEn('America/Guayaquil')), hasta = String(req.query.hasta || desde);
  const inicio = new Date(desde + 'T00:00:00-05:00'), fin = new Date(hasta + 'T23:59:59-05:00');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta) || !Number.isFinite(+inicio) || !Number.isFinite(+fin) || fin < inicio || +fin - +inicio > 32 * 86400000) throw new ErrorHorarios(400,'Selecciona un rango de hasta 31 días.');
  const [buses, viajes, agenda] = await Promise.all([
    listarBuses(coop), listarViajes(desde,hasta,coop),
    prisma.agenda_bus.findMany({ where: { cooperativa_id: coop, activa: true, tipo: { in: ['DESCANSO','MANTENIMIENTO'] }, inicio: { lte: fin }, fin: { gte: inicio } }, select: { id:true,bus_id:true,tipo:true,inicio:true,fin:true,motivo:true } }),
  ]);
  res.json({ datos: { buses, viajes, agenda } });
});
router.post('/planificacion/rotar', async (req,res) => {
  const s = res.locals.sesion, b = req.body;
  if (!s.coopId) throw new ErrorHorarios(403,'Cooperativa no asignada.');
  if (!Array.isArray(b?.bus_ids) || !b.bus_ids.length || b.bus_ids.length > 50 || b.bus_ids.some((id: unknown) => typeof id !== 'string' || !uuid.test(id)) || new Set(b.bus_ids).size !== b.bus_ids.length) throw new ErrorHorarios(400,'Selecciona entre uno y cincuenta buses distintos.');
  let datos; try { datos = validarGeneracion({ ...b, bus_id: b.bus_ids[0] }, hoyEn('America/Guayaquil')); } catch(e) { throw new ErrorHorarios(400,(e as Error).message); }
  const frecuencia = await prisma.frecuencias.findFirst({ where: { id: datos.frecuencia_id, cooperativa_id: s.coopId, activa: true }, include: { dias_frecuencia:true } });
  if (!frecuencia) throw new ErrorHorarios(404,'Frecuencia activa no encontrada en tu cooperativa.');
  const buses = await listarBuses(s.coopId);
  const elegidos = b.bus_ids as string[];
  if (elegidos.some(id => !buses.some(bus => bus.id === id && bus.estado === 'ACTIVO' && bus.asientos_activos === bus.capacidad))) throw new ErrorHorarios(400,'Todos los buses deben estar activos y tener su distribución completa.');
  const fechas = fechasDeOperacion(datos.desde,datos.hasta,frecuencia.dias_frecuencia.map(d => d.dia_iso));
  if (!fechas.length) throw new ErrorHorarios(400,'La frecuencia no opera en el rango seleccionado.');
  const creados: { id:string;fecha:string;salida:string;llegada:string;asientos:number }[] = [], omitidos: {fecha:string;motivo:string}[] = [];
  let siguiente = 0;
  for (const fecha of fechas) {
    let creado = false, motivo = 'No hay buses disponibles.';
    for (let intento = 0; intento < elegidos.length; intento++) {
      const indice = (siguiente + intento) % elegidos.length;
      try {
        const salida = await programarViajes({ ...datos, bus_id: elegidos[indice], desde: fecha, hasta: fecha }, s.id, s.coopId);
        if (salida.creados.length) { creados.push(...salida.creados); siguiente = (indice + 1) % elegidos.length; creado = true; break; }
        motivo = salida.omitidos[0]?.motivo || motivo;
      } catch(e) { motivo = e instanceof Error ? e.message : motivo; }
    }
    if (!creado) omitidos.push({fecha,motivo});
  }
  res.status(creados.length ? 201 : 200).json({ mensaje: `Se programaron ${creados.length} viajes con rotación de buses.`, datos: { creados,omitidos } });
});
router.use('/planificacion', (e: unknown, _req: import('express').Request, res: import('express').Response, _next: import('express').NextFunction) => { if (!(e instanceof ErrorHorarios)) console.error('[planificacion]',e); res.status(e instanceof ErrorHorarios ? e.estado : 500).json({error:e instanceof ErrorHorarios ? e.message : 'No se pudo completar la planificación.'}); });
export default router;
