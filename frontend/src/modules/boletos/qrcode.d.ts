// Tipos mínimos de la librería "qrcode" (solo lo que usa este módulo).
declare module "qrcode" {
  interface OpcionesQr {
    margin?: number;
    width?: number;
    errorCorrectionLevel?: "L" | "M" | "Q" | "H";
    color?: { dark?: string; light?: string };
  }

  const QRCode: {
    toDataURL(texto: string, opciones?: OpcionesQr): Promise<string>;
  };

  export default QRCode;
}
