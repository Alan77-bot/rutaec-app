import type { Request, Response } from "express";
import {
  listarBusesPorCooperativa,
  registrarBus,
  listarGruposBuses,
  actualizarBus,
  cambiarEstadoBus,
  type DatosEdicionBus,
} from "./buses.service.js";
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function obtenerBuses(
  req: Request,
  res: Response
): Promise<void> {
  const sesion = res.locals.sesion;

  if (!sesion) {
    res.status(401).json({ error: "Debes iniciar sesión" });
    return;
  }

  if (sesion.rol !== "admin" && sesion.rol !== "cooperativa") {
    res.status(403).json({
      error: "No tienes permisos para consultar la flota",
    });
    return;
  }

  const cooperativaId =
    sesion.rol === "admin"
      ? req.query.cooperativaId
      : sesion.coopId;

  if (
    typeof cooperativaId !== "string" ||
    !UUID_REGEX.test(cooperativaId)
  ) {
    res.status(400).json({
      error: "Debes proporcionar una cooperativa válida",
    });
    return;
  }

  try {
    const buses = await listarBusesPorCooperativa(cooperativaId);

    res.status(200).json({
      total: buses.length,
      datos: buses,
    });
  } catch (error) {
    console.error("Error al consultar la flota:", error);

    res.status(500).json({
      error: "No se pudieron consultar los buses",
    });
  }
}

export async function crearBus(
  req: Request,
  res: Response
): Promise<void> {
  const sesion = res.locals.sesion;

  if (!sesion) {
    res.status(401).json({ error: "Debes iniciar sesión" });
    return;
  }

  if (sesion.rol !== "admin" && sesion.rol !== "cooperativa") {
    res.status(403).json({
      error: "No tienes permisos para registrar buses",
    });
    return;
  }

  const datos = req.body;

  if (!datos || typeof datos !== "object" || Array.isArray(datos)) {
    res.status(400).json({ error: "Debes enviar los datos del bus" });
    return;
  }

  const cooperativaId =
    sesion.rol === "admin"
      ? datos.cooperativaId
      : sesion.coopId;

  if (
    typeof cooperativaId !== "string" ||
    !UUID_REGEX.test(cooperativaId) ||
    typeof datos.grupoId !== "string" ||
    !UUID_REGEX.test(datos.grupoId)
  ) {
    res.status(400).json({
      error: "La cooperativa o el grupo son inválidos",
    });
    return;
  }

  const campos = [
    "placa",
    "numeroUnidad",
    "color",
    "marcaChasis",
    "marcaCarroceria",
  ] as const;

  for (const campo of campos) {
    if (
      typeof datos[campo] !== "string" ||
      !datos[campo].trim() ||
      datos[campo].trim().length > 100
    ) {
      res.status(400).json({
        error: `El campo ${campo} es obligatorio y debe tener máximo 100 caracteres`,
      });
      return;
    }
  }

  if (
    !Number.isInteger(datos.pisos) ||
    datos.pisos < 1 ||
    datos.pisos > 3 ||
    !Number.isInteger(datos.capacidad) ||
    datos.capacidad < 1 ||
    datos.capacidad > 100 ||
    (datos.anio != null &&
      (!Number.isInteger(datos.anio) ||
        datos.anio < 1950 ||
        datos.anio > new Date().getFullYear() + 1)) ||
    (datos.imagenUrl != null &&
      (typeof datos.imagenUrl !== "string" ||
        datos.imagenUrl.length > 2048))
  ) {
    res.status(400).json({
      error: "Año, pisos, capacidad o imagen inválidos",
    });
    return;
  }

  try {
    const resultado = await registrarBus({
      cooperativaId,
      grupoId: datos.grupoId,
      placa: datos.placa.trim().toUpperCase(),
      numeroUnidad: datos.numeroUnidad.trim(),
      color: datos.color.trim(),
      marcaChasis: datos.marcaChasis.trim(),
      marcaCarroceria: datos.marcaCarroceria.trim(),
      anio: datos.anio ?? null,
      pisos: datos.pisos,
      capacidad: datos.capacidad,
      imagenUrl: datos.imagenUrl ?? null,
    });

    if ("error" in resultado) {
      res.status(400).json({ error: resultado.error });
      return;
    }

    res.status(201).json({ datos: resultado.bus });
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "P2002"
    ) {
      res.status(409).json({
        error: "Ya existe un bus con esa placa o número de unidad",
      });
      return;
    }

    console.error("Error al registrar bus:", error);
    res.status(500).json({
      error: "No se pudo registrar el bus",
    });
  }
}

export async function obtenerGruposBuses(
  req: Request,
  res: Response
): Promise<void> {
  const sesion = res.locals.sesion;

  if (!sesion) {
    res.status(401).json({ error: "Debes iniciar sesión" });
    return;
  }

  if (sesion.rol !== "admin" && sesion.rol !== "cooperativa") {
    res.status(403).json({ error: "No tienes permisos" });
    return;
  }

  const cooperativaId =
    sesion.rol === "admin"
      ? req.query.cooperativaId
      : sesion.coopId;

  if (
    typeof cooperativaId !== "string" ||
    !UUID_REGEX.test(cooperativaId)
  ) {
    res.status(400).json({
      error: "Cooperativa inválida",
    });
    return;
  }

  try {
    const grupos = await listarGruposBuses(cooperativaId);
    res.json({ datos: grupos });
  } catch (error) {
    console.error("Error al consultar grupos:", error);
    res.status(500).json({
      error: "No se pudieron consultar los grupos",
    });
  }


}



export async function editarBus(
  req: Request,
  res: Response
): Promise<void> {
  const sesion = res.locals.sesion;

  if (!sesion) {
    res.status(401).json({
      error: "Debes iniciar sesión",
    });
    return;
  }

  if (
    sesion.rol !== "admin" &&
    sesion.rol !== "cooperativa"
  ) {
    res.status(403).json({
      error: "No tienes permisos para editar buses",
    });
    return;
  }

  const busId = req.params.id;

  if (
    typeof busId !== "string" ||
    !UUID_REGEX.test(busId)
  ) {
    res.status(400).json({
      error: "El identificador del bus es inválido",
    });
    return;
  }

  const datos = req.body;

  if (
    !datos ||
    typeof datos !== "object" ||
    Array.isArray(datos)
  ) {
    res.status(400).json({
      error: "Debes enviar los datos del bus",
    });
    return;
  }

  // Nunca se permite cambiar la cooperativa del bus.
  if (
    "cooperativaId" in datos ||
    "cooperativa_id" in datos
  ) {
    res.status(400).json({
      error: "No se puede cambiar la cooperativa del bus",
    });
    return;
  }

  const cooperativaId =
    sesion.rol === "admin"
      ? req.query.cooperativaId
      : sesion.coopId;

  if (
    typeof cooperativaId !== "string" ||
    !UUID_REGEX.test(cooperativaId)
  ) {
    res.status(400).json({
      error: "La cooperativa es inválida",
    });
    return;
  }

  const camposPermitidos = [
    "grupoId",
    "placa",
    "numeroUnidad",
    "color",
    "marcaChasis",
    "marcaCarroceria",
    "anio",
    "pisos",
    "capacidad",
    "imagenUrl",
  ] as const;

  const camposRecibidos = Object.keys(datos);

  if (
    camposRecibidos.length === 0 ||
    camposRecibidos.some(
      (campo) =>
        !camposPermitidos.includes(
          campo as (typeof camposPermitidos)[number]
        )
    )
  ) {
    res.status(400).json({
      error: "Debes enviar al menos un campo permitido",
    });
    return;
  }

  if (
    datos.grupoId !== undefined &&
    (typeof datos.grupoId !== "string" ||
      !UUID_REGEX.test(datos.grupoId))
  ) {
    res.status(400).json({
      error: "El grupo es inválido",
    });
    return;
  }

  const camposTexto = [
    "placa",
    "numeroUnidad",
    "color",
    "marcaChasis",
    "marcaCarroceria",
  ] as const;

  for (const campo of camposTexto) {
    if (
      datos[campo] !== undefined &&
      (typeof datos[campo] !== "string" ||
        !datos[campo].trim() ||
        datos[campo].trim().length > 100)
    ) {
      res.status(400).json({
        error: `El campo ${campo} debe contener entre 1 y 100 caracteres`,
      });
      return;
    }
  }

  if (
    (datos.pisos !== undefined &&
      (!Number.isInteger(datos.pisos) ||
        datos.pisos < 1 ||
        datos.pisos > 3)) ||
    (datos.capacidad !== undefined &&
      (!Number.isInteger(datos.capacidad) ||
        datos.capacidad < 1 ||
        datos.capacidad > 100)) ||
    (datos.anio != null &&
      (!Number.isInteger(datos.anio) ||
        datos.anio < 1950 ||
        datos.anio > new Date().getFullYear() + 1)) ||
    (datos.imagenUrl != null &&
      (typeof datos.imagenUrl !== "string" ||
        datos.imagenUrl.length > 2048))
  ) {
    res.status(400).json({
      error: "Año, pisos, capacidad o imagen inválidos",
    });
    return;
  }

  const cambios: DatosEdicionBus = {};

  for (const campo of camposPermitidos) {
    if (datos[campo] !== undefined) {
      cambios[campo] = datos[campo];
    }
  }

  if (cambios.placa !== undefined) {
    cambios.placa = cambios.placa.trim().toUpperCase();
  }

  for (const campo of camposTexto) {
    if (campo !== "placa" && cambios[campo] !== undefined) {
      cambios[campo] = cambios[campo].trim();
    }
  }

  try {
    const resultado = await actualizarBus(
      busId,
      cooperativaId,
      cambios
    );

   if ("error" in resultado) {
  res.status(resultado.estado ?? 400).json({
    error: resultado.error,
  });
  return;
}

    res.status(200).json({
      datos: resultado.bus,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "P2002"
    ) {
      res.status(409).json({
        error: "Ya existe un bus con esa placa o número de unidad",
      });
      return;
    }

    console.error("Error al editar bus:", error);

    res.status(500).json({
      error: "No se pudo editar el bus",
    });
  }
}



export async function cambiarEstadoDeBus(
  req: Request,
  res: Response
): Promise<void> {
  const sesion = res.locals.sesion;

  if (!sesion) {
    res.status(401).json({ error: "Debes iniciar sesión" });
    return;
  }

  if (sesion.rol !== "admin" && sesion.rol !== "cooperativa") {
    res.status(403).json({ error: "No tienes permisos para cambiar el estado del bus" });
    return;
  }

  const busId = req.params.id;
  const cooperativaId =
    sesion.rol === "admin"
      ? req.query.cooperativaId
      : sesion.coopId;

  if (
    typeof busId !== "string" ||
    !UUID_REGEX.test(busId) ||
    typeof cooperativaId !== "string" ||
    !UUID_REGEX.test(cooperativaId)
  ) {
    res.status(400).json({ error: "Bus o cooperativa inválidos" });
    return;
  }

  const datos = req.body;

  if (
    !datos ||
    typeof datos !== "object" ||
    Array.isArray(datos) ||
    Object.keys(datos).length !== 1 ||
    !["ACTIVO", "INACTIVO"].includes(datos.estado)
  ) {
    res.status(400).json({
      error: "Debes enviar únicamente el estado ACTIVO o INACTIVO",
    });
    return;
  }

  try {
    const resultado = await cambiarEstadoBus(
      busId,
      cooperativaId,
      datos.estado as "ACTIVO" | "INACTIVO"
    );

    if ("error" in resultado) {
      res.status(resultado.estado ?? 400).json({ error: resultado.error });
      return;
    }

    res.status(200).json({ datos: resultado.bus });
  } catch (error) {
    console.error("Error al cambiar estado del bus:", error);
    res.status(500).json({
      error: "No se pudo cambiar el estado del bus",
    });
  }
}
