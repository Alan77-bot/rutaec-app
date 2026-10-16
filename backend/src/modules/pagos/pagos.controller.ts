import type { Request, Response } from "express";
import { crearPago, ErrorPago, listarPagos, listarPagosPendientes } from "./pagos.service.js";

export async function obtenerPagos(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const pagos = await listarPagos();
    res.status(200).json({ total: pagos.length, datos: pagos });
  } catch (error) {
    console.error("Error al consultar pagos:", error);
    res.status(500).json({ error: "No se pudieron consultar los pagos" });
  }
}

export async function obtenerPagosPendientes(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const pagos = await listarPagosPendientes();
    res.status(200).json({ total: pagos.length, datos: pagos });
  } catch (error) {
    console.error("Error al consultar pagos pendientes:", error);
    res.status(500).json({ error: "No se pudieron consultar los pagos pendientes" });
  }
}

export async function registrarPago(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { pago, creado } = await crearPago(req.body ?? {});
    res.status(creado ? 201 : 200).json({ datos: pago });
  } catch (error) {
    if (error instanceof ErrorPago) {
      res.status(error.estado).json({ error: error.message });
      return;
    }
    console.error("Error al registrar pago:", error);
    res.status(500).json({ error: "No se pudo registrar el pago" });
  }
}
