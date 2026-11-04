import { obtenerTransporte } from "./correo.transporte.js";

export async function enviarEnlaceRecuperacion(
  destinatario: string,
  token: string,
  venceEn: Date
): Promise<void> {
  const correo = destinatario.trim();

  if (
    correo.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)
  ) {
    throw new Error("El correo de destino no es válido.");
  }

  if (!/^[a-f0-9]{64}$/.test(token)) {
    throw new Error("El token de recuperación no es válido.");
  }

  if (
    !Number.isFinite(venceEn.getTime()) ||
    venceEn.getTime() <= Date.now()
  ) {
    throw new Error("La fecha de vencimiento no es válida.");
  }

  const frontendUrl = process.env.FRONTEND_URL;

  if (!frontendUrl) {
    throw new Error("Falta configurar FRONTEND_URL.");
  }

  const base = new URL(frontendUrl);

  if (
    !["http:", "https:"].includes(base.protocol) ||
    base.username ||
    base.password
  ) {
    throw new Error("FRONTEND_URL no tiene un formato permitido.");
  }

  if (
    process.env.NODE_ENV === "production" &&
    base.protocol !== "https:"
  ) {
    throw new Error("FRONTEND_URL debe utilizar HTTPS en producción.");
  }

  const enlace = new URL("/restablecer-contrasena", base.origin);

  // El fragmento no se envía al servidor al abrir la página.
  enlace.hash = new URLSearchParams({ token }).toString();

  const vencimiento = new Intl.DateTimeFormat("es-EC", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Guayaquil",
  }).format(venceEn);

  const { transporte: cliente, usuario } = obtenerTransporte();

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
      subject: "Recupera tu contraseña de RutaEC",
      text: [
        "Recuperación de contraseña — RutaEC",
        "",
        "Recibimos una solicitud para cambiar la contraseña de tu cuenta.",
        "",
        "Abre este enlace para establecer una nueva contraseña:",
        enlace.toString(),
        "",
        `El enlace vence el ${vencimiento}, hora de Ecuador continental.`,
        "Solo puede utilizarse una vez.",
        "No compartas este enlace con otras personas.",
        "",
        "Si no solicitaste este cambio, ignora el mensaje.",
        "Tu contraseña no cambia hasta completar el proceso.",
      ].join("\n"),
    });

    if (resultado.accepted.length === 0) {
      throw new Error("El servidor no aceptó el destinatario.");
    }
  } catch {
    throw new Error("No se pudo enviar el correo de recuperación.");
  }
}