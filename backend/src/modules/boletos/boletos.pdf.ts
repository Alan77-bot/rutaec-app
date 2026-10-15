import PDFDocument from "pdfkit";
import { qrComoPng } from "./boletos.qr.js";
import type { DatosEmision } from "./boletos.service.js";

type BoletoParaPdf = {
  codigo: string;
  estado: string;
  qr_token: string;
  datos_emision: DatosEmision;
};

const ZONA = "America/Guayaquil";

function fechaHora(valor: string): string {
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return String(valor);

  return fecha.toLocaleString("es-EC", {
    timeZone: ZONA,
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dinero(valor: number | string, moneda: string): string {
  return `${moneda} ${Number(valor).toFixed(2)}`;
}

function colorValido(valor: string | null | undefined, porDefecto: string) {
  return valor && /^#[0-9a-f]{6}$/i.test(valor) ? valor : porDefecto;
}

export async function generarPdfBoleto(boleto: BoletoParaPdf): Promise<Buffer> {
  const d = boleto.datos_emision;
  const qr = await qrComoPng(boleto.qr_token);
  const primario = colorValido(d.color_primario, "#1b3f68");

  const doc = new PDFDocument({
    size: [620, 270],
    margin: 0,
    info: { Title: `Boleto ${boleto.codigo}`, Author: "RutaEC" },
  });

  const partes: Buffer[] = [];
  doc.on("data", (parte: Buffer) => partes.push(parte));
  const terminado = new Promise<Buffer>((resolver) =>
    doc.on("end", () => resolver(Buffer.concat(partes)))
  );

  // Franja superior con el color de la cooperativa
  doc.rect(0, 0, 620, 52).fill(primario);
  doc.fillColor("#ffffff").fontSize(18).font("Helvetica-Bold");
  doc.text(d.cooperativa, 24, 17, { width: 400 });
  doc.fontSize(10).font("Helvetica");
  doc.text("RutaEC · Boleto de viaje", 400, 21, { width: 196, align: "right" });

  // Ruta
  doc.fillColor("#1a1a1a").font("Helvetica-Bold").fontSize(20);
  doc.text(`${d.origen}  →  ${d.destino}`, 24, 68, { width: 400 });

  const fila = (etiqueta: string, valor: string, x: number, y: number) => {
    doc.font("Helvetica").fontSize(8).fillColor("#6b7280").text(etiqueta.toUpperCase(), x, y);
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#111111").text(valor, x, y + 11, { width: 190 });
  };

  const nombre = `${d.pasajero.nombres ?? ""} ${d.pasajero.apellidos ?? ""}`.trim();
  fila("Pasajero", nombre || "—", 24, 108);
  fila("Salida", fechaHora(d.salida), 24, 146);
  fila("Llegada", fechaHora(d.llegada), 24, 184);
  fila("Asiento", `${d.asiento.numero ?? "—"}${d.asiento.categoria ? " · " + d.asiento.categoria : ""}`, 230, 108);
  fila("Bus", `${d.unidad ? "N.º " + d.unidad : "—"}${d.placa ? " · " + d.placa : ""}`, 230, 146);
  fila("Importe", dinero(d.importe, d.moneda), 230, 184);

  // QR
  doc.image(qr, 440, 70, { width: 150 });
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#111111");
  doc.text(boleto.codigo.slice(0, 8).toUpperCase(), 440, 224, { width: 150, align: "center" });
  doc.font("Helvetica").fontSize(8).fillColor("#6b7280");
  doc.text(
    boleto.estado === "EMITIDO" ? "Presenta este código al abordar" : "BOLETO ANULADO",
    440,
    238,
    { width: 150, align: "center" }
  );

  doc.end();
  return terminado;
}
