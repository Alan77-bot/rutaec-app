import QRCode from "qrcode";

// Lo único que lleva el QR es el token del boleto (un UUID aleatorio):
// no incluye nombres, documentos ni precios.
export function contenidoQr(qrToken: string): string {
  return `RUTAEC:${qrToken}`;
}

export function qrComoPng(qrToken: string): Promise<Buffer> {
  return QRCode.toBuffer(contenidoQr(qrToken), {
    type: "png",
    margin: 1,
    width: 360,
    errorCorrectionLevel: "M",
  });
}
