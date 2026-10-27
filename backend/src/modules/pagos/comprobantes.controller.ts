import type { Request, RequestHandler, Response } from "express";
import multer from "multer";
import type { SesionAutenticada } from "../../middlewares/autenticacion.js";
import {
  abrirComprobante,
  registrarPagoConComprobante,
  TAMANO_MAXIMO,
} from "./comprobantes.service.js";
import { ErrorPago } from "./pagos.service.js";

const recibir = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TAMANO_MAXIMO, files: 1, fields: 10 },
}).single("archivo");

export const recibirArchivo: RequestHandler = (req, res, next) => {
  recibir(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      const grande = error.code === "LIMIT_FILE_SIZE";
      res
        .status(grande ? 413 : 400)
        .json({ error: grande ? "El archivo supera 5 MB" : "Archivo invalido" });
      return;
    }
    if (error) {
      next(error);
      return;
    }
    next();
  });
};

export async function cargarComprobante(
  req: Request,
  res: Response
): Promise<void> {
  const sesion = res.locals.sesion as SesionAutenticada;
  try {
    const datos = await registrarPagoConComprobante(
      sesion.id,
      req.file,
      req.body ?? {}
    );
    res.status(datos.creado ? 201 : 200).json({ datos });
  } catch (error) {
    if (error instanceof ErrorPago) {
      res.status(error.estado).json({ error: error.message });
      return;
    }
    console.error("Error al registrar el pago con comprobante:", error);
    res.status(500).json({ error: "No se pudo registrar el comprobante" });
  }
}

export async function descargarComprobante(
  req: Request,
  res: Response
): Promise<void> {
  const sesion = res.locals.sesion as SesionAutenticada;
  try {
    const { flujo, tipo } = await abrirComprobante(
      sesion,
      String(req.params.id)
    );
    res.setHeader("Content-Type", tipo);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Disposition", 'inline; filename="comprobante"');
    flujo.on("error", (error) => {
      console.error("Error al leer comprobante:", error);
      if (!res.headersSent) {
        res.status(404).json({ error: "El archivo no esta disponible" });
      } else {
        res.destroy();
      }
    });
    flujo.pipe(res);
  } catch (error) {
    if (error instanceof ErrorPago) {
      res.status(error.estado).json({ error: error.message });
      return;
    }
    console.error("Error al consultar comprobante:", error);
    res.status(500).json({ error: "No se pudo consultar el comprobante" });
  }
}
