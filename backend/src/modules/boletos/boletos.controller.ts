import type { Request, Response } from "express";
import { generarPdfBoleto } from "./boletos.pdf.js";
import { qrComoPng } from "./boletos.qr.js";
import { verificarQr } from "./boletos.verificacion.js";
import {
  buscarBoletoConPermiso,
  ErrorBoleto,
  listarBoletosDelUsuario,
  obtenerBoleto,
  type SesionBoletos,
} from "./boletos.service.js";

function sesionDe(res: Response): SesionBoletos {
  return res.locals.sesion as SesionBoletos;
}

function responderError(res: Response, error: unknown, contexto: string): void {
  if (error instanceof ErrorBoleto) {
    res.status(error.estado).json({ error: error.message });
    return;
  }

  console.error(`[boletos] Error en ${contexto}`);
  res.status(500).json({ error: "No se pudo completar la operación." });
}

export async function misBoletos(_req: Request, res: Response): Promise<void> {
  try {
    const boletos = await listarBoletosDelUsuario(sesionDe(res).id);
    res.status(200).json({ total: boletos.length, datos: boletos });
  } catch (error) {
    responderError(res, error, "listar boletos");
  }
}

export async function detalleBoleto(req: Request, res: Response): Promise<void> {
  try {
    const boleto = await obtenerBoleto(String(req.params.id), sesionDe(res));
    res.status(200).json({ datos: boleto });
  } catch (error) {
    responderError(res, error, "consultar boleto");
  }
}

export async function pdfBoleto(req: Request, res: Response): Promise<void> {
  try {
    const fila = await buscarBoletoConPermiso(String(req.params.id), sesionDe(res));
    const pdf = await generarPdfBoleto(fila);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="boleto-${fila.codigo.slice(0, 8)}.pdf"`
    );
    res.status(200).send(pdf);
  } catch (error) {
    responderError(res, error, "generar PDF");
  }
}

export async function imagenQr(req: Request, res: Response): Promise<void> {
  try {
    const fila = await buscarBoletoConPermiso(String(req.params.id), sesionDe(res));
    const png = await qrComoPng(fila.qr_token);

    res.setHeader("Content-Type", "image/png");
    res.status(200).send(png);
  } catch (error) {
    responderError(res, error, "generar QR");
  }
}

export async function verificarBoleto(req: Request, res: Response): Promise<void> {
  try {
    const resultado = await verificarQr(
      req.body?.codigo,
      sesionDe(res),
      req.body?.viajeId
    );
    res.status(200).json({ datos: resultado });
  } catch (error) {
    responderError(res, error, "verificar QR");
  }
}
