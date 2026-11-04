import type { Request, Response } from "express";

import {
  consultarDistribucionBus,
  actualizarDistribucionBus,
  type DatosAsiento,
} from "./asientos.service.js";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function esUUID(valor: unknown): valor is string {
  return typeof valor === "string" && UUID.test(valor);
}

function esObjeto(
  valor: unknown
): valor is Record<string, unknown> {
  return typeof valor === "object" &&
    valor !== null &&
    !Array.isArray(valor);
}

function esAsiento(valor: unknown): valor is DatosAsiento {
  if (!esObjeto(valor)) return false;

  return (
    typeof valor.numero === "string" &&
    valor.numero.trim().length > 0 &&
    valor.numero.length <= 20 &&
    Number.isInteger(valor.piso) &&
    Number.isInteger(valor.fila) &&
    Number.isInteger(valor.columna) &&
    (valor.piso as number) >= 1 &&
    (valor.piso as number) <= 3 &&
    (valor.fila as number) >= 1 &&
    (valor.fila as number) <= 100 &&
    (valor.columna as number) >= 1 &&
    (valor.columna as number) <= 20 &&
    typeof valor.categoria === "string" &&
    valor.categoria.trim().length > 0 &&
    valor.categoria.length <= 100 &&
    typeof valor.preferencial === "boolean" &&
    typeof valor.accesible === "boolean" &&
    typeof valor.activo === "boolean"
  );
}

function contexto(req: Request, res: Response) {
  const sesion = res.locals.sesion;

  if (!sesion) {
    return { error: "Debes iniciar sesion", estado: 401 };
  }

  if (sesion.rol !== "admin" && sesion.rol !== "cooperativa") {
    return { error: "No tienes permisos", estado: 403 };
  }

  const cooperativaId =
    sesion.rol === "admin"
      ? req.query.cooperativaId
      : sesion.coopId;

  if (!esUUID(req.params.id) || !esUUID(cooperativaId)) {
    return { error: "Bus o cooperativa invalidos", estado: 400 };
  }

  return {
    busId: req.params.id as string,
    cooperativaId,
  };
}

export async function obtenerAsientosBus(
  req: Request,
  res: Response
): Promise<void> {
  const ctx = contexto(req, res);

  if ("error" in ctx) {
    res.status(ctx.estado ?? 400).json({ error: ctx.error });
    return;
  }

  try {
    const resultado = await consultarDistribucionBus(
      ctx.busId,
      ctx.cooperativaId
    );

    if ("error" in resultado) {
      res.status(resultado.estado).json({
        error: resultado.error,
      });
      return;
    }

    res.status(200).json({ datos: resultado.datos });
  } catch (error) {
    console.error("Error consultando asientos:", error);
    res.status(500).json({
      error: "No se pudo consultar la distribucion",
    });
  }
}

export async function guardarAsientosBus(
  req: Request,
  res: Response
): Promise<void> {
  const ctx = contexto(req, res);

  if ("error" in ctx) {
    res.status(ctx.estado ?? 400).json({ error: ctx.error });
    return;
  }

  const cuerpo: unknown = req.body;

  if (
    !esObjeto(cuerpo) ||
    Object.keys(cuerpo).length !== 1 ||
    !Array.isArray(cuerpo.asientos) ||
    cuerpo.asientos.length < 1 ||
    cuerpo.asientos.length > 100 ||
    !cuerpo.asientos.every(esAsiento)
  ) {
    res.status(400).json({
      error: "Debes enviar entre 1 y 100 asientos validos",
    });
    return;
  }

  try {
    const resultado = await actualizarDistribucionBus(
      ctx.busId,
      ctx.cooperativaId,
      cuerpo.asientos
    );

    if ("error" in resultado) {
      res.status(resultado.estado).json({
        error: resultado.error,
      });
      return;
    }

    res.status(200).json({
      mensaje: "Distribucion guardada correctamente",
      datos: resultado.datos,
    });
  } catch (error) {
    console.error("Error guardando asientos:", error);
    res.status(500).json({
      error: "No se pudo guardar la distribucion",
    });
  }
}
