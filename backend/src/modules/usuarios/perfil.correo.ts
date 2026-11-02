import { obtenerTransporte } from "./correo.transporte.js";

export async function enviarCodigoCambioCorreo(destinatario: string, codigo: string): Promise<void> {
  const { transporte, usuario } = obtenerTransporte();
  const resultado = await transporte.sendMail({
    from: { name: "RutaEC", address: usuario },
    to: { address: destinatario, name: "" },
    subject: "Confirma tu nuevo correo en RutaEC",
    text: `Tu código para cambiar el correo de tu cuenta RutaEC es: ${codigo}\n\nVence en 15 minutos. Ingresa el código en Mi perfil. Tu correo anterior no cambia hasta confirmar. Si no solicitaste este cambio, ignora este mensaje.`,
  });
  if (resultado.accepted.length === 0) throw new Error("Correo no aceptado");
}
