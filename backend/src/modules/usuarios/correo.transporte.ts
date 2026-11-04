import "dotenv/config";
import nodemailer from "nodemailer";
import { prisma } from '../../lib/prisma.js';

let transporte: ReturnType<typeof nodemailer.createTransport> | undefined;

function obtenerConfiguracion() {
  const usuario = process.env.SMTP_USER?.trim();
  const clave = process.env.SMTP_PASS?.replace(/\s/g, "");

  if (!usuario || !clave) {
    throw new Error(
      "Falta configurar SMTP_USER o SMTP_PASS en el backend."
    );
  }

  return { usuario, clave };
}

export function obtenerTransporte() {
  if (process.env.NODE_ENV === 'development' && (!process.env.SMTP_USER || !process.env.SMTP_PASS)) {
    if (!transporte) transporte = nodemailer.createTransport({
      name: 'bandeja-local', version: '1.0',
      send(mail, callback) {
        const para = Array.isArray(mail.data.to) ? mail.data.to[0] : mail.data.to;
        const destinatario = typeof para === 'string' ? para : para && 'address' in para ? String(para.address) : '';
        const texto = String(mail.data.text || mail.data.html || 'Correo sin texto');
        prisma.$queryRaw<{id:string}[]>`INSERT INTO rutaec.correos_desarrollo(destinatario,asunto,texto) VALUES(${destinatario},${mail.data.subject || 'RutaEC'},${texto}) RETURNING id`
          .then(filas => callback(null, { messageId: `LOCAL-${filas[0].id}`, accepted: [destinatario], rejected: [], response: 'Guardado en bandeja local de desarrollo' }))
          .catch(e => callback(e));
      },
    });
    return { transporte, usuario: 'no-reply@rutaec.local' };
  }
  const { usuario, clave } = obtenerConfiguracion();

  if (!transporte) {
    transporte = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: usuario,
        pass: clave,
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 30000,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
  }

  return { transporte, usuario };
}
