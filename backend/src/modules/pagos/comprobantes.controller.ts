import type { Request, RequestHandler, Response } from "express";
import multer from "multer";
import type { SesionAutenticada } from "../../middlewares/autenticacion.js";
import { subirComprobante, TAMANO_MAXIMO } from "./comprobantes.service.js";
import { ErrorPago } from "./pagos.service.js";

const recibir = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TAMANO_MAXIMO, files: 1, fields: 5 },
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
    const datos = await subirComprobante(
      sesion.id,
      String(req.params.id),
      req.file,
      req.body ?? {}
    );
    res.status(201).json({ datos });
  } catch (error) {
    if (error instanceof ErrorPago) {
      res.status(error.estado).json({ error: error.message });
      return;
    }
    console.error("Error al subir comprobante:", error);
    res.status(500).json({ error: "No se pudo registrar el comprobante" });
  }
}
