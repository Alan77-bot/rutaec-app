
import type { Request, Response } from "express";
import {
  listarCooperativas,
  registrarCooperativa,
  actualizarCooperativa,
  cambiarEstadoCooperativa,
} from "./cooperativas.service.js";

export async function obtenerCooperativas(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const cooperativas = await listarCooperativas();

    res.status(200).json({
      total: cooperativas.length,
      datos: cooperativas,
    });
  } catch (error) {
    console.error("Error al consultar cooperativas:", error);

    res.status(500).json({
      error: "No se pudieron consultar las cooperativas",
    });
  }
}



export async function crearCooperativa(
  req: Request,
  res: Response
): Promise<void> {
  const campos = [
    "ruc",
    "razon_social",
    "nombre_comercial",
    "correo",
    "telefono",
    "direccion",
  ] as const;

  const cuerpo = req.body;

  if (
    !cuerpo ||
    typeof cuerpo !== "object" ||
    Array.isArray(cuerpo)
  ) {
    res.status(400).json({
      error: "Debes proporcionar los datos de la cooperativa",
    });
    return;
  }

  for (const campo of campos) {
    if (
      typeof cuerpo[campo] !== "string" ||
      cuerpo[campo].trim() === ""
    ) {
      res.status(400).json({
        error: `El campo ${campo} es obligatorio`,
      });
      return;
    }
  }

  if (!/^\d{13}$/.test(cuerpo.ruc.trim())) {
    res.status(400).json({
      error: "El RUC debe contener exactamente 13 dígitos",
    });
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cuerpo.correo.trim())) {
    res.status(400).json({
      error: "El correo electrónico no es válido",
    });
    return;
  }

  try {
    const cooperativa = await registrarCooperativa(cuerpo);

    res.status(201).json({
      mensaje: "Cooperativa registrada correctamente",
      datos: cooperativa,
    });
  } catch (error) {
    const codigo =
      error !== null &&
      typeof error === "object" &&
      "code" in error
        ? error.code
        : null;

    if (codigo === "P2002") {
      res.status(409).json({
        error: "Ya existe una cooperativa con ese RUC",
      });
      return;
    }

    console.error("Error al registrar cooperativa:", error);

    res.status(500).json({
      error: "No se pudo registrar la cooperativa",
    });
  }
}



export async function editarCooperativa(
  req: Request,
  res: Response
): Promise<void> {
  const id = req.params.id;

  if (typeof id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    res.status(400).json({
      error: "El identificador de la cooperativa no es válido",
    });
    return;
  }

  const cuerpo = req.body;

  if (
    !cuerpo ||
    typeof cuerpo !== "object" ||
    Array.isArray(cuerpo)
  ) {
    res.status(400).json({
      error: "Debes proporcionar los datos a actualizar",
    });
    return;
  }

  const camposPermitidos = [
    "razon_social",
    "nombre_comercial",
    "correo",
    "telefono",
    "direccion",
    "sitio_web",
  ] as const;

  const camposRecibidos = Object.keys(cuerpo);

  if (
    camposRecibidos.length === 0 ||
    camposRecibidos.some(
      (campo) => !camposPermitidos.includes(campo as typeof camposPermitidos[number])
    )
  ) {
    res.status(400).json({
      error: "La solicitud contiene campos no permitidos o está vacía",
    });
    return;
  }

  const datos: Record<string, string | null> = {};

  for (const campo of camposPermitidos) {
    if (!(campo in cuerpo)) continue;

    const valor = cuerpo[campo];

    if (campo === "sitio_web" && valor === null) {
      datos[campo] = null;
      continue;
    }

    if (typeof valor !== "string") {
      res.status(400).json({
        error: `El campo ${campo} debe ser texto`,
      });
      return;
    }

    const limpio = valor.trim();

    if (campo !== "sitio_web" && limpio === "") {
      res.status(400).json({
        error: `El campo ${campo} no puede estar vacío`,
      });
      return;
    }

    if (
      campo === "correo" &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpio)
    ) {
      res.status(400).json({
        error: "El correo electrónico no es válido",
      });
      return;
    }

    datos[campo] = limpio;
  }

  try {
    const cooperativa = await actualizarCooperativa(id, datos);

    res.status(200).json({
      mensaje: "Cooperativa actualizada correctamente",
      datos: cooperativa,
    });
  } catch (error) {
    const codigo =
      error !== null &&
      typeof error === "object" &&
      "code" in error
        ? error.code
        : null;

    if (codigo === "P2025") {
      res.status(404).json({
        error: "La cooperativa no existe",
      });
      return;
    }

    console.error("Error al actualizar cooperativa:", error);

    res.status(500).json({
      error: "No se pudo actualizar la cooperativa",
    });
  }
}



export async function actualizarEstadoCooperativa(
  req: Request,
  res: Response
): Promise<void> {
  const id = req.params.id;

  if (
    typeof id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
  ) {
    res.status(400).json({
      error: "El identificador de la cooperativa no es válido",
    });
    return;
  }

  const cuerpo = req.body;

  if (
    !cuerpo ||
    typeof cuerpo !== "object" ||
    Array.isArray(cuerpo) ||
    Object.keys(cuerpo).length !== 1 ||
    typeof cuerpo.activa !== "boolean"
  ) {
    res.status(400).json({
      error: "Debes enviar únicamente el campo activa con valor true o false",
    });
    return;
  }

  try {
    const cooperativa = await cambiarEstadoCooperativa(
      id,
      cuerpo.activa
    );

    res.status(200).json({
      mensaje: cuerpo.activa
        ? "Cooperativa activada correctamente"
        : "Cooperativa desactivada correctamente",
      datos: cooperativa,
    });
  } catch (error) {
    const codigo =
      error !== null &&
      typeof error === "object" &&
      "code" in error
        ? error.code
        : null;

    if (codigo === "P2025") {
      res.status(404).json({
        error: "La cooperativa no existe",
      });
      return;
    }

    console.error("Error al cambiar el estado de la cooperativa:", error);

    res.status(500).json({
      error: "No se pudo cambiar el estado de la cooperativa",
    });
  }
}
