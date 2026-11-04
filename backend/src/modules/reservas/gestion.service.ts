import { documentoPasajero } from './documento.js';
import { createHash } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import type { SesionAutenticada } from "../../middlewares/autenticacion.js";
import { buscarViajePorId } from "./reservas.service.js";

export class ErrorReserva extends Error {
  constructor(public estado: number, mensaje: string) { super(mensaje); }
}
const uuid = (x: unknown): x is string => typeof x === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
function texto(x: unknown, campo: string, max = 100) {
  if (typeof x !== "string" || !x.trim() || x.trim().length > max) throw new ErrorReserva(400, `Revisa ${campo}.`);
  return x.trim();
}
function filtro(s: SesionAutenticada) {
  if (s.rol === "usuario") return { comprador_id: s.id };
  if (s.rol === "oficinista" && s.coopId) return { cooperativa_id: s.coopId };
  throw new ErrorReserva(403, "Esta operación corresponde al cliente o al oficinista.");
}
export async function listarReservas(s: SesionAutenticada) {
  return prisma.compras.findMany({ where: filtro(s), orderBy: { creada_en: "desc" }, take: 100,
    select: { id: true, estado: true, total: true, moneda: true, creada_en: true, vence_en: true, cooperativa_id: true, motivo: true } });
}
export async function detalleReserva(s: SesionAutenticada, id: string) {
  if (!uuid(id)) throw new ErrorReserva(400, "Reserva inválida.");
  const compra = await prisma.compras.findFirst({ where: { id, ...filtro(s) }, include: {
    pagos: { select: { id: true, metodo: true, estado: true, motivo: true, creado_en: true } },
  } });
  if (!compra) throw new ErrorReserva(404, "No se encontró la reserva.");
  const [detalles, boletos, cooperativa] = await Promise.all([
    prisma.detalle_compra.findMany({ where: { compra_id: id }, select: { id:true,pasajero_snapshot:true,asiento_snapshot:true,origen_orden:true,destino_orden:true,precio_base:true,descuento:true,importe:true,estado:true } }),
    prisma.boletos.findMany({ where: { compra_id:id }, select:{id:true,codigo:true,estado:true} }),
    prisma.cooperativas.findUniqueOrThrow({ where:{id:compra.cooperativa_id},select:{nombre_comercial:true} }),
  ]);
  // La vista efectiva no conserva una reserva vencida aunque el worker esté detenido.
  return { ...compra, detalle_compra: detalles, boletos, cooperativas:cooperativa, estado: compra.estado === "RESERVADA" && compra.vence_en && compra.vence_en <= new Date() ? "VENCIDA" : compra.estado, ahora: new Date().toISOString() };
}
export async function crearReserva(s: SesionAutenticada, entrada: Record<string, unknown>) {
  filtro(s);
  if (!entrada || typeof entrada !== "object") throw new ErrorReserva(400, "Datos inválidos.");
  if (!uuid(entrada.viajeId) || !uuid(entrada.claveIdempotencia)) throw new ErrorReserva(400, "Viaje o solicitud inválidos.");
  const origen = texto(entrada.origen, "origen"), destino = texto(entrada.destino, "destino");
  if (!Array.isArray(entrada.pasajeros) || entrada.pasajeros.length < 1 || entrada.pasajeros.length > 10) throw new ErrorReserva(400, "Selecciona entre uno y diez pasajeros.");
  const comprador = s.rol === "usuario" ? s.id : entrada.compradorId;
  if (!uuid(comprador)) throw new ErrorReserva(400, "Ventanilla requiere una cuenta de comprador activa y verificada.");
  const pasajeros = entrada.pasajeros.map((p: Record<string, unknown>) => {
    if (!p || typeof p !== "object" || !uuid(p.asientoId)) throw new ErrorReserva(400, "Asiento inválido.");
    const nacimiento = texto(p.fechaNacimiento, "fecha de nacimiento", 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nacimiento) || !Number.isFinite(new Date(nacimiento).getTime()) || new Date(nacimiento).toISOString().slice(0,10) !== nacimiento || new Date(nacimiento) > new Date()) throw new ErrorReserva(400, "Fecha de nacimiento inválida.");
    let identidad;
    try{identidad=documentoPasajero(p);}catch(e){throw new ErrorReserva(400,e instanceof Error?e.message:'Documento inválido.');}
    if (p.validacionId && !uuid(p.validacionId)) throw new ErrorReserva(400, "Validación inválida.");
    return { asientoId: p.asientoId, nombres: texto(p.nombres, "nombres"), apellidos: texto(p.apellidos, "apellidos"), ...identidad, nacimiento, validacionId: p.validacionId || null };
  });
  if (new Set(pasajeros.map(p => p.asientoId)).size !== pasajeros.length || new Set(pasajeros.map(p => `${p.paisDocumento}:${p.tipoDocumento}:${p.documento}`)).size !== pasajeros.length) throw new ErrorReserva(400, "No repitas asientos ni pasajeros en la reserva.");
  const huella = createHash("sha256").update(JSON.stringify({ comprador, viaje: entrada.viajeId, origen, destino, pasajeros })).digest("hex");
  const clave = `reserva-solicitud:${s.id}:${entrada.claveIdempotencia}`;
  const id = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${clave}, 0))::text`;
    await tx.$queryRaw`SELECT set_config('app.usuario_id', ${s.id}, true)`;
    const previa = await tx.eventos_salida.findUnique({ where: { clave_deduplicacion: clave } });
    if (previa) {
      const datos = previa.datos as { huella?: string; compra_id?: string };
      if (datos.huella !== huella || !datos.compra_id) throw new ErrorReserva(409, "La solicitud ya se usó con otros datos.");
      return datos.compra_id;
    }
    const viaje = await buscarViajePorId(entrada.viajeId as string, origen, destino, tx);
    if (!viaje) throw new ErrorReserva(409, "El viaje o tramo ya no está disponible.");
    if (s.rol === "oficinista" && viaje.cooperativa.id !== s.coopId) throw new ErrorReserva(403, "Solo puedes vender viajes de tu cooperativa.");
    // Todas las reservas del viaje comparten estos candados aunque tengan claves
    // de idempotencia distintas. El orden evita ciclos al pedir varios asientos.
    const asientosIds = pasajeros.map(p => p.asientoId);
    const bloqueados = await tx.$queryRaw<{id:string}[]>`
      SELECT id FROM rutaec.asientos_viaje
      WHERE viaje_id=${viaje.viaje_id}::uuid AND id=ANY(${asientosIds}::uuid[])
      ORDER BY id FOR UPDATE`;
    if (bloqueados.length !== asientosIds.length) throw new ErrorReserva(409, "Uno de los asientos no pertenece al viaje.");
    const conflictos = await tx.$queryRaw<{id:string}[]>`
      SELECT d.id FROM rutaec.detalle_compra d
      JOIN rutaec.compras c ON c.id=d.compra_id
      WHERE d.viaje_id=${viaje.viaje_id}::uuid AND d.asiento_id=ANY(${asientosIds}::uuid[])
        AND d.tramo && int4range(${viaje.origen_orden}::integer,${viaje.destino_orden}::integer,'[)')
        AND (d.estado='CONFIRMADO' OR (d.estado='RETENIDO' AND
          (c.estado='EN_REVISION' OR (c.estado='RESERVADA' AND c.vence_en>clock_timestamp()))))
      LIMIT 1`;
    if (conflictos.length) throw new ErrorReserva(409, "El asiento ya no está disponible para ese tramo. Elige otro asiento.");
    const items = [];
    for (const p of pasajeros) {
      const pasajero = await tx.pasajeros.upsert({
        where: { comprador_id_pais_documento_tipo_documento_numero_documento: { comprador_id: comprador, pais_documento: p.paisDocumento, tipo_documento: p.tipoDocumento, numero_documento: p.documento } },
        update: { nombres: p.nombres, apellidos: p.apellidos, fecha_nacimiento: new Date(p.nacimiento) },
        create: { comprador_id: comprador, nombres: p.nombres, apellidos: p.apellidos, fecha_nacimiento: new Date(p.nacimiento), tipo_documento: p.tipoDocumento, pais_documento: p.paisDocumento, numero_documento: p.documento },
      });
      const asiento = await tx.asientos_viaje.findUnique({ where: { viaje_id_id: { viaje_id: viaje.viaje_id, id: p.asientoId } } });
      if (!asiento?.vendible) throw new ErrorReserva(409, "Uno de los asientos no está habilitado.");
      const tarifa = await tx.tarifas_viaje.findFirst({ where: { viaje_id: viaje.viaje_id, origen_orden: viaje.origen_orden, destino_orden: viaje.destino_orden, categoria: asiento.categoria } });
      if (!tarifa) throw new ErrorReserva(409, "No hay tarifa para ese asiento y tramo.");
      items.push({ pasajero_id: pasajero.id, asiento_id: p.asientoId, tarifa_id: tarifa.id, validacion_id: p.validacionId });
    }
    const [r] = await tx.$queryRaw<{ id: string }[]>`SELECT rutaec.reservar_compra(${comprador}::uuid, ${viaje.viaje_id}::uuid, ${JSON.stringify(items)}::jsonb)::text AS id`;
    await tx.$queryRaw`SELECT rutaec.encolar_evento('RESERVA_SOLICITADA', ${r.id}::uuid, ${viaje.cooperativa.id}::uuid, ${clave}, ${JSON.stringify({ huella, compra_id: r.id })}::jsonb)::text`;
    return r.id;
  }, { isolationLevel: "ReadCommitted" });
  return detalleReserva(s, id);
}
export async function cancelarReserva(s: SesionAutenticada, id: string, motivo: unknown) {
  await detalleReserva(s, id);
  const razon = texto(motivo, "motivo", 500);
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT set_config('app.usuario_id', ${s.id}, true)`;
    await tx.$queryRaw`SELECT rutaec.cancelar_reserva(${id}::uuid, ${razon})`;
  });
  return detalleReserva(s, id);
}

export function iniciarVencimientoReservas() {
  let ocupado = false;
  const ciclo = async () => {
    if (ocupado) return; ocupado = true;
    try { await prisma.$queryRaw`SELECT rutaec.vencer_reservas()`; }
    catch { console.error("[reservas] No se pudo ejecutar el vencimiento automático"); }
    finally { ocupado = false; }
  };
  void ciclo();
  setInterval(ciclo, 15000).unref();
}
