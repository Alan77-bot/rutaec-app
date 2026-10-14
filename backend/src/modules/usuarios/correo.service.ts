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

function obtenerTransporte() {
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

export async function enviarCodigoVerificacion(
  destinatario: string,
  codigo: string,
  venceEn: Date
): Promise<void> {
  const correo = destinatario.trim();

  if (
    correo.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)
  ) {
    throw new Error("El correo de destino no es válido.");
  }

  if (!/^\d{6}$/.test(codigo)) {
    throw new Error("El código debe contener seis dígitos.");
  }

  if (
    !Number.isFinite(venceEn.getTime()) ||
    venceEn.getTime() <= Date.now()
  ) {
    throw new Error("La fecha de vencimiento del código no es válida.");
  }

  const { transporte: cliente, usuario } = obtenerTransporte();

  const vencimiento = new Intl.DateTimeFormat("es-EC", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Guayaquil",
  }).format(venceEn);

  try {
    const resultado = await cliente.sendMail({
      from: {
        name: "RutaEC",
        address: usuario,
      },
      to: {
        address: correo,
        name: "",
      },
      subject: "Verifica tu correo en RutaEC",
      text: [
        "Verificación de correo — RutaEC",
        "",
        `Tu código de verificación es: ${codigo}`,
        "",
        `Vence el ${vencimiento}, hora de Ecuador continental.`,
        "Ingresa este código en la pantalla de verificación.",
        "No compartas el código con otras personas.",
        "",
        "Si no solicitaste crear una cuenta, ignora este mensaje.",
      ].join("\n"),
    });

    if (resultado.accepted.length === 0) {
      throw new Error("El servidor no aceptó el destinatario.");
    }
  } catch {
    throw new Error(
      "No se pudo enviar el correo de verificación. Inténtalo nuevamente."
    );
  }
}