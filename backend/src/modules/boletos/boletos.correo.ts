import { prisma } from "../../lib/prisma.js";
import { generarPdfBoleto } from "./boletos.pdf.js";
import type { DatosEmision } from "./boletos.service.js";

const TIPO_EVENTO = "BOLETOS_EMITIDOS";
const MAX_INTENTOS = 5;
const INTERVALO_MS = 15_000;

type EventoPendiente = {
  id: string;
  entidad_id: string;
  cooperativa_id: string | null;
  intentos: number;
};

type BoletoCorreo = {
  id: string;
  codigo: string;
  estado: string;
  qr_token: string;
  datos_emision: DatosEmision;
  comprador_id: string;
  correo_destino: string;
};

const escapar = (texto: unknown): string =>
  String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function fecha(valor: string): string {
  const f = new Date(valor);
  if (Number.isNaN(f.getTime())) return String(valor);
  return f.toLocaleString("es-EC", {
    timeZone: "America/Guayaquil",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function cuerpoHtml(boletos: BoletoCorreo[]): { asunto: string; html: string } {
  const primero = boletos[0].datos_emision;
  const asunto = `Tus boletos ${primero.origen} → ${primero.destino} · ${primero.cooperativa}`;

  const filas = boletos
    .map((b) => {
      const d = b.datos_emision;
      const nombre = `${d.pasajero.nombres ?? ""} ${d.pasajero.apellidos ?? ""}`.trim();
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb">${escapar(nombre)}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb">Asiento ${escapar(d.asiento.numero)}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb">${escapar(b.codigo.slice(0, 8).toUpperCase())}</td>
      </tr>`;
    })
    .join("");

  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#111">
    <h2 style="color:#1b3f68">¡Tu pago fue confirmado!</h2>
    <p>Estos son tus boletos de <b>${escapar(primero.cooperativa)}</b> para el viaje
    <b>${escapar(primero.origen)} → ${escapar(primero.destino)}</b>.</p>
    <p>Salida: <b>${escapar(fecha(primero.salida))}</b><br/>
    Llegada: ${escapar(fecha(primero.llegada))}</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">${filas}</table>
    <p>Adjuntamos un PDF por pasajero con su código QR. Preséntalo al abordar.</p>
    <p style="color:#6b7280;font-size:12px">RutaEC · Este mensaje se generó automáticamente.</p>
  </div>`;

  return { asunto, html };
}

// "local" no envía nada: solo deja constancia en la consola (para pruebas sin SMTP real).
async function enviar(opciones: {
  para: string;
  asunto: string;
  html: string;
  adjuntos: { nombre: string; contenido: Buffer }[];
}): Promise<string> {
  const proveedor = (process.env.EMAIL_PROVIDER ?? "local").toLowerCase();

  if (proveedor === "local") {
    console.log(
      `[correo:local] Para ${opciones.para} · "${opciones.asunto}" · ${opciones.adjuntos.length} PDF`
    );
    return `local-${Date.now()}`;
  }

  if (proveedor !== "resend") {
    throw new Error(`Proveedor de correo no soportado: ${proveedor}`);
  }

  const clave = process.env.RESEND_API_KEY;
  if (!clave) throw new Error("Falta RESEND_API_KEY");

  const respuesta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "RutaEC <onboarding@resend.dev>",
      to: [opciones.para],
      subject: opciones.asunto,
      html: opciones.html,
      attachments: opciones.adjuntos.map((a) => ({
        filename: a.nombre,
        content: a.contenido.toString("base64"),
      })),
    }),
  });

  if (!respuesta.ok) {
    throw new Error(`El proveedor respondió ${respuesta.status}`);
  }

  const cuerpo = (await respuesta.json()) as { id?: string };
  return cuerpo.id ?? "sin-id";
}

// Toma un evento pendiente de forma segura aunque haya varios procesos.
async function tomarEvento(): Promise<EventoPendiente | null> {
  const filas = await prisma.$queryRawUnsafe<EventoPendiente[]>(
    `UPDATE rutaec.eventos_salida
        SET estado = 'PROCESANDO',
            intentos = intentos + 1,
            bloqueado_hasta = clock_timestamp() + interval '5 minutes'
      WHERE id = (
        SELECT id FROM rutaec.eventos_salida
         WHERE tipo = $1
           AND ((estado = 'PENDIENTE' AND disponible_en <= clock_timestamp())
             OR (estado = 'PROCESANDO' AND bloqueado_hasta < clock_timestamp()))
         ORDER BY creado_en
         LIMIT 1
         FOR UPDATE SKIP LOCKED)
      RETURNING id::text AS id, entidad_id::text AS entidad_id,
                cooperativa_id::text AS cooperativa_id, intentos`,
    TIPO_EVENTO
  );
  return filas[0] ?? null;
}

async function procesarEvento(evento: EventoPendiente): Promise<void> {
  const boletos = await prisma.$queryRawUnsafe<BoletoCorreo[]>(
    `SELECT b.id::text AS id, b.codigo::text AS codigo, b.estado, b.qr_token::text AS qr_token,
            b.datos_emision, c.comprador_id::text AS comprador_id, c.correo_destino
       FROM rutaec.boletos b JOIN rutaec.compras c ON c.id = b.compra_id
      WHERE b.compra_id = $1::uuid AND b.estado = 'EMITIDO'
      ORDER BY b.emitido_en`,
    evento.entidad_id
  );

  if (boletos.length === 0) throw new Error("La compra no tiene boletos emitidos");

  const destino = boletos[0].correo_destino;
  const clave = `boletos-correo:${evento.entidad_id}`;

  // Un solo registro de envío por compra: si el evento se reintenta no se duplica el correo.
  const envio = await prisma.$queryRawUnsafe<{ id: string; estado: string }[]>(
    `INSERT INTO rutaec.envios_correo(evento_id, destinatario, plantilla, variables, compra_id, clave_deduplicacion)
     VALUES ($1::uuid, $2, 'BOLETOS_EMITIDOS', $3::jsonb, $4::uuid, $5)
     ON CONFLICT (clave_deduplicacion) DO UPDATE SET intentos = rutaec.envios_correo.intentos + 1
     RETURNING id::text AS id, estado`,
    evento.id,
    destino,
    JSON.stringify({ boletos: boletos.length }),
    evento.entidad_id,
    clave
  );

  if (envio[0].estado !== "ENVIADO") {
    try {
      const adjuntos = await Promise.all(
        boletos.map(async (b) => ({
          nombre: `boleto-${b.codigo.slice(0, 8)}.pdf`,
          contenido: await generarPdfBoleto(b),
        }))
      );
      const { asunto, html } = cuerpoHtml(boletos);
      const proveedorId = await enviar({ para: destino, asunto, html, adjuntos });

      await prisma.$executeRawUnsafe(
        `UPDATE rutaec.envios_correo
            SET estado = 'ENVIADO', enviado_en = clock_timestamp(), proveedor_id = $2, ultimo_error = NULL
          WHERE id = $1::uuid`,
        envio[0].id,
        proveedorId
      );
    } catch (error) {
      // El fallo queda registrado en el envío y se relanza para reintentar el evento.
      await prisma.$executeRawUnsafe(
        `UPDATE rutaec.envios_correo SET estado = 'ERROR', ultimo_error = $2 WHERE id = $1::uuid`,
        envio[0].id,
        error instanceof Error ? error.message.slice(0, 300) : "Error desconocido"
      );
      throw error;
    }
  }

  // Aviso dentro de la aplicación para el comprador (una sola vez por compra).
  await prisma.$executeRawUnsafe(
    `INSERT INTO rutaec.notificaciones(usuario_id, cooperativa_id, evento_id, tipo, titulo, mensaje, destino_interno, clave_deduplicacion)
     VALUES ($1::uuid, $2::uuid, $3::uuid, 'BOLETOS_EMITIDOS', 'Tus boletos están listos',
             'Tu pago fue confirmado. Ya puedes descargar tus boletos.', '/mis-viajes', $4)
     ON CONFLICT (clave_deduplicacion) DO NOTHING`,
    boletos[0].comprador_id,
    evento.cooperativa_id,
    evento.id,
    `boletos-aviso:${evento.entidad_id}`
  );

  await prisma.$executeRawUnsafe(
    `UPDATE rutaec.eventos_salida SET estado = 'COMPLETADO', procesado_en = clock_timestamp(), ultimo_error = NULL
      WHERE id = $1::uuid`,
    evento.id
  );
}

async function registrarFallo(evento: EventoPendiente, error: unknown): Promise<void> {
  const definitivo = evento.intentos >= MAX_INTENTOS;
  await prisma.$executeRawUnsafe(
    `UPDATE rutaec.eventos_salida
        SET estado = $2, bloqueado_hasta = NULL, ultimo_error = $3,
            disponible_en = clock_timestamp() + ($4 || ' minutes')::interval
      WHERE id = $1::uuid`,
    evento.id,
    definitivo ? "ERROR" : "PENDIENTE",
    error instanceof Error ? error.message.slice(0, 300) : "Error desconocido",
    String(evento.intentos * 2)
  );
}

// Procesa todos los eventos que estén listos y devuelve cuántos completó.
export async function procesarCorreosDeBoletos(): Promise<number> {
  let completados = 0;

  for (;;) {
    const evento = await tomarEvento();
    if (!evento) break;

    try {
      await procesarEvento(evento);
      completados += 1;
    } catch (error) {
      console.error(`[boletos] No se pudo enviar el correo del evento ${evento.id}`);
      await registrarFallo(evento, error);
    }
  }

  return completados;
}

export function iniciarProcesadorDeCorreos(): void {
  let ocupado = false;

  setInterval(async () => {
    if (ocupado) return;
    ocupado = true;
    try {
      await procesarCorreosDeBoletos();
    } catch {
      console.error("[boletos] Falló el ciclo del procesador de correos");
    } finally {
      ocupado = false;
    }
  }, INTERVALO_MS).unref();
}
