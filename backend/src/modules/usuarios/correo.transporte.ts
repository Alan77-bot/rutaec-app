import "dotenv/config";
import nodemailer from "nodemailer";

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
