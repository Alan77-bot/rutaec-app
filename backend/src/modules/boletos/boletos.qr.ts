import QRCode from "qrcode";

const PREFIJO = "RUTAEC:";
const TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Lo único que lleva el QR es el token del boleto (un UUID aleatorio):
// no incluye nombres, documentos ni precios.
export function contenidoQr(qrToken: string): string {
  return `${PREFIJO}${qrToken}`;
}

// Devuelve el token si el texto leído del QR tiene el formato de RutaEC; si no, null.
export function extraerToken(contenido: unknown): string | null {
  if (typeof contenido !== "string") return null;

  const texto = contenido.trim();
  if (!texto.startsWith(PREFIJO)) return null;

  const token = texto.slice(PREFIJO.length);
  return TOKEN.test(token) ? token.toLowerCase() : null;
}

export function qrComoPng(qrToken: string): Promise<Buffer> {
  return QRCode.toBuffer(contenidoQr(qrToken), {
    type: "png",
    margin: 1,
    width: 360,
    errorCorrectionLevel: "M",
  });
}
