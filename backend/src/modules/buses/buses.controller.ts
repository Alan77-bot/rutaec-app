
import type { Request, Response } from "express";

import {
  listarBusesPorCooperativa,
  registrarBus,
  listarGruposBuses,
  actualizarBus,
  cambiarEstadoBus,
  listarComodidades,
  type DatosEdicionBus,
  type EstadoBus,
} from "./buses.service.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CAMPOS_TEXTO = [
  "placa",
  "numeroUnidad",
  "color",
  "marcaChasis",
  "marcaCarroceria",
] as const;

const CAMPOS_EDICION = [
  "grupoId",
  ...CAMPOS_TEXTO,
  "anio",
  "pisos",
  "capacidad",
  "imagenUrl",
  "comodidades",
] as const;

const ESTADOS_PERMITIDOS: EstadoBus[] = [
  "ACTIVO",
  "INACTIVO",
  "MANTENIMIENTO",
];

function esObjeto(
  valor: unknown
): valor is Record<string, unknown> {
  return (
    typeof valor === "object" &&
    valor !== null &&
    !Array.isArray(valor)
  );
}

function esUUID(valor: unknown): valor is string {
  return (
    typeof valor === "string" &&
    UUID_REGEX.test(valor)
  );
}

function esTextoValido(valor: unknown): valor is string {
  return (
    typeof valor === "string" &&
    valor.trim().length > 0 &&
    valor.trim().length <= 100
  );
}

function sonComodidadesValidas(
  valor: unknown
): valor is string[] {
  return (
    Array.isArray(valor) &&
    valor.length <= 100 &&
    valor.every(
      (codigo) =>
        typeof codigo === "string" &&
        codigo.trim().length > 0 &&
        codigo.length <= 100
    )
  );
}

function sonNumerosValidos(
  datos: Record<string, unknown>
): boolean {
  return (
    (datos.pisos === undefined ||
      (Number.isInteger(datos.pisos) &&
        (datos.pisos as number) >= 1 &&
        (datos.pisos as number) <= 3)) &&
    (datos.capacidad === undefined ||
      (Number.isInteger(datos.capacidad) &&
        (datos.capacidad as number) >= 1 &&
        (datos.capacidad as number) <= 100)) &&
    (datos.anio == null ||
      (Number.isInteger(datos.anio) &&
        (datos.anio as number) >= 1950 &&
        (datos.anio as number) <=
          new Date().getFullYear() + 1)) &&
    (datos.imagenUrl == null ||
      (typeof datos.imagenUrl === "string" &&
        datos.imagenUrl.length <= 2048))
  );
}

function obtenerCooperativaId(
  req: Request,
  res: Response,
  origen: "query" | "body"
): unknown {
  const sesion = res.locals.sesion;

  if (sesion.rol !== "admin") {
    return sesion.coopId;
  }

  return origen === "query"
    ? req.query.cooperativaId
    : req.body?.cooperativaId;
}

function verificarAcceso(
  res: Response,
  operacion: string
): boolean {
  const sesion = res.locals.sesion;

  if (!sesion) {
    res.status(401).json({
      error: "Debes iniciar sesión",
    });
    return false;
  }

  if (
    sesion.rol !== "admin" &&
    sesion.rol !== "cooperativa"
  ) {
    res.status(403).json({
      error: `No tienes permisos para ${operacion}`,
    });
    return false;
  }

  return true;
}

function esErrorUnico(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    error.code === "P2002"
  );
}

// ========================================
// CONSULTAR BUSES
// ========================================

export async function obtenerBuses(
  req: Request,
  res: Response
): Promise<void> {
  if (!verificarAcceso(res, "consultar la flota")) {
    return;
  }

  const cooperativaId = obtenerCooperativaId(
    req,
    res,
    "query"
  );

  if (!esUUID(cooperativaId)) {
    res.status(400).json({
      error: "Debes proporcionar una cooperativa válida",
    });
    return;
  }

  try {
    const buses = await listarBusesPorCooperativa(
      cooperativaId
    );

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

// ========================================
// CONSULTAR GRUPOS
// ========================================

export async function obtenerGruposBuses(
  req: Request,
  res: Response
): Promise<void> {
  if (!verificarAcceso(res, "consultar grupos")) {
    return;
  }

  const cooperativaId = obtenerCooperativaId(
    req,
    res,
    "query"
  );

  if (!esUUID(cooperativaId)) {
    res.status(400).json({
      error: "Cooperativa inválida",
    });
    return;
  }

  try {
    const grupos = await listarGruposBuses(
      cooperativaId
    );

    res.status(200).json({
      datos: grupos,
    });
  } catch (error) {
    console.error("Error al consultar grupos:", error);

    res.status(500).json({
      error: "No se pudieron consultar los grupos",
    });
  }
}

// ========================================
// CONSULTAR COMODIDADES
// ========================================

export async function obtenerComodidades(
  req: Request,
  res: Response
): Promise<void> {
  if (!verificarAcceso(res, "consultar comodidades")) {
    return;
  }

  try {
    const comodidades = await listarComodidades();

    res.status(200).json({
      datos: comodidades,
    });
  } catch (error) {
    console.error(
      "Error al consultar comodidades:",
      error
    );

    res.status(500).json({
      error: "No se pudieron consultar las comodidades",
    });
  }
}

// ========================================
// REGISTRAR BUS
// ========================================

export async function crearBus(
  req: Request,
  res: Response
): Promise<void> {
  if (!verificarAcceso(res, "registrar buses")) {
    return;
  }

  const datos: unknown = req.body;

  if (!esObjeto(datos)) {
    res.status(400).json({
      error: "Debes enviar los datos del bus",
    });
    return;
  }

  const cooperativaId =
    res.locals.sesion.rol === "admin"
      ? datos.cooperativaId
      : res.locals.sesion.coopId;

  if (
    !esUUID(cooperativaId) ||
    !esUUID(datos.grupoId)
  ) {
    res.status(400).json({
      error: "La cooperativa o el grupo son inválidos",
    });
    return;
  }

  for (const campo of CAMPOS_TEXTO) {
    if (!esTextoValido(datos[campo])) {
      res.status(400).json({
        error:
          `El campo ${campo} es obligatorio y debe tener máximo 100 caracteres`,
      });
      return;
    }
  }

  if (
    datos.pisos === undefined ||
    datos.capacidad === undefined ||
    !sonNumerosValidos(datos)
  ) {
    res.status(400).json({
      error: "Año, pisos, capacidad o imagen inválidos",
    });
    return;
  }

  // Si el frontend antiguo todavía no envía
  // comodidades, se utiliza un arreglo vacío.
  const comodidades = datos.comodidades ?? [];

  if (!sonComodidadesValidas(comodidades)) {
    res.status(400).json({
      error: "Las comodidades enviadas son inválidas",
    });
    return;
  }

  try {
    const resultado = await registrarBus({
      cooperativaId,
      grupoId: datos.grupoId as string,
      placa: (datos.placa as string)
        .trim()
        .toUpperCase(),
      numeroUnidad: (datos.numeroUnidad as string).trim(),
      color: (datos.color as string).trim(),
      marcaChasis: (datos.marcaChasis as string).trim(),
      marcaCarroceria: (
        datos.marcaCarroceria as string
      ).trim(),
      anio: (datos.anio as number | null) ?? null,
      pisos: datos.pisos as number,
      capacidad: datos.capacidad as number,
      imagenUrl:
        (datos.imagenUrl as string | null) ?? null,
      comodidades,
    });

    if ("error" in resultado) {
      res.status(resultado.estado ?? 400).json({
        error: resultado.error,
      });
      return;
    }

    res.status(201).json({
      datos: resultado.bus,
    });
  } catch (error) {
    if (esErrorUnico(error)) {
      res.status(409).json({
        error:
          "Ya existe un bus con esa placa o número de unidad",
      });
      return;
    }

    console.error("Error al registrar bus:", error);

    res.status(500).json({
      error: "No se pudo registrar el bus",
    });
  }
}

// ========================================
// EDITAR BUS
// ========================================

export async function editarBus(
  req: Request,
  res: Response
): Promise<void> {
  if (!verificarAcceso(res, "editar buses")) {
    return;
  }

  const busId = req.params.id;

  if (!esUUID(busId)) {
    res.status(400).json({
      error: "El identificador del bus es inválido",
    });
    return;
  }

  const datos: unknown = req.body;

  if (!esObjeto(datos)) {
    res.status(400).json({
      error: "Debes enviar los datos del bus",
    });
    return;
  }

  // La cooperativa propietaria nunca se modifica.
  if (
    "cooperativaId" in datos ||
    "cooperativa_id" in datos
  ) {
    res.status(400).json({
      error: "No se puede cambiar la cooperativa del bus",
    });
    return;
  }

  const cooperativaId = obtenerCooperativaId(
    req,
    res,
    "query"
  );

  if (!esUUID(cooperativaId)) {
    res.status(400).json({
      error: "La cooperativa es inválida",
    });
    return;
  }

  const camposRecibidos = Object.keys(datos);

  if (
    camposRecibidos.length === 0 ||
    camposRecibidos.some(
      (campo) =>
        !CAMPOS_EDICION.includes(
          campo as (typeof CAMPOS_EDICION)[number]
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
    !esUUID(datos.grupoId)
  ) {
    res.status(400).json({
      error: "El grupo es inválido",
    });
    return;
  }

  for (const campo of CAMPOS_TEXTO) {
    if (
      datos[campo] !== undefined &&
      !esTextoValido(datos[campo])
    ) {
      res.status(400).json({
        error:
          `El campo ${campo} debe contener entre 1 y 100 caracteres`,
      });
      return;
    }
  }

  if (!sonNumerosValidos(datos)) {
    res.status(400).json({
      error: "Año, pisos, capacidad o imagen inválidos",
    });
    return;
  }

  if (
    datos.comodidades !== undefined &&
    !sonComodidadesValidas(datos.comodidades)
  ) {
    res.status(400).json({
      error: "Las comodidades enviadas son inválidas",
    });
    return;
  }

  const cambios: DatosEdicionBus = {};

  for (const campo of CAMPOS_EDICION) {
    if (datos[campo] !== undefined) {
      // La validación anterior ya verificó los tipos.
      Object.assign(cambios, {
        [campo]: datos[campo],
      });
    }
  }

  if (cambios.placa !== undefined) {
    cambios.placa = cambios.placa
      .trim()
      .toUpperCase();
  }

  for (const campo of CAMPOS_TEXTO) {
    if (
      campo !== "placa" &&
      cambios[campo] !== undefined
    ) {
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
    if (esErrorUnico(error)) {
      res.status(409).json({
        error:
          "Ya existe un bus con esa placa o número de unidad",
      });
      return;
    }

    console.error("Error al editar bus:", error);

    res.status(500).json({
      error: "No se pudo editar el bus",
    });
  }
}

// ========================================
// CAMBIAR ESTADO
// ========================================

export async function cambiarEstadoDeBus(
  req: Request,
  res: Response
): Promise<void> {
  if (
    !verificarAcceso(
      res,
      "cambiar el estado del bus"
    )
  ) {
    return;
  }

  const busId = req.params.id;

  const cooperativaId = obtenerCooperativaId(
    req,
    res,
    "query"
  );

  if (
    !esUUID(busId) ||
    !esUUID(cooperativaId)
  ) {
    res.status(400).json({
      error: "Bus o cooperativa inválidos",
    });
    return;
  }

  const datos: unknown = req.body;

  if (
    !esObjeto(datos) ||
    Object.keys(datos).length !== 1 ||
    typeof datos.estado !== "string" ||
    !ESTADOS_PERMITIDOS.includes(
      datos.estado as EstadoBus
    )
  ) {
    res.status(400).json({
      error:
        "Debes enviar únicamente el estado ACTIVO, INACTIVO o MANTENIMIENTO",
    });
    return;
  }

  try {
    const resultado = await cambiarEstadoBus(
      busId,
      cooperativaId,
      datos.estado as EstadoBus
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
    console.error(
      "Error al cambiar estado del bus:",
      error
    );

    res.status(500).json({
      error: "No se pudo cambiar el estado del bus",
    });
  }
}
