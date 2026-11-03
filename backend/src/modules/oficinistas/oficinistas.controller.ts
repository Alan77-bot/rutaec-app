import type { Request, Response } from "express";
import type { SesionAutenticada } from "../../middlewares/autenticacion.js";
import {
  comprobarGerente,
  obtenerOficinistas,
  asignarOficinista,
  cambiarEstadoOficinista,
  obtenerUsuariosDisponiblesOficinista,
} from "./oficinistas.service.js";

function responderError(res: Response, error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "estado" in error &&
    "message" in error &&
    typeof error.estado === "number" &&
    typeof error.message === "string"
  ) {
    res.status(error.estado).json({ error: error.message });
    return;
  }

  console.error("[oficinistas]", error);
  res.status(500).json({ error: "No se pudo completar la operación." });
}

async function ejecutar(
  req: Request,
  res: Response,
  accion: (cooperativaId: string) => Promise<unknown>,
  estado = 200
) {
  try {
    const sesion = res.locals.sesion as SesionAutenticada;

    if (!sesion.coopId) {
      res.status(403).json({ error: "No tienes una cooperativa asignada." });
      return;
    }

    await comprobarGerente(sesion.id, sesion.coopId);

    const datos = await accion(sesion.coopId);
    res.status(estado).json({ datos });
  } catch (error) {
    responderError(res, error);
  }
}

export async function listarOficinistas(req: Request, res: Response) {
  await ejecutar(req, res, obtenerOficinistas);
}

export async function crearAsignacionOficinista(req: Request, res: Response) {
  await ejecutar(
    req,
    res,
    (cooperativaId) => asignarOficinista(cooperativaId, req.body),
    201
  );
}

export async function actualizarEstadoOficinista(req: Request, res: Response) {
  await ejecutar(req, res, (cooperativaId) =>
    cambiarEstadoOficinista(
      cooperativaId,
      String(req.params.id),
      req.body
    )
  );
}



export async function listarUsuariosDisponiblesOficinista(
  req: Request,
  res: Response
) {
  try {
    const sesion = res.locals.sesion as SesionAutenticada;

    if (!sesion.coopId) {
      res.status(403).json({
        error: "No tienes una cooperativa asignada.",
      });
      return;
    }

    await comprobarGerente(sesion.id, sesion.coopId);

    const leerEntero = (
      valor: unknown,
      predeterminado: number
    ): number => {
      if (valor === undefined) return predeterminado;

      if (
        typeof valor !== "string" ||
        !/^[1-9]\d*$/.test(valor)
      ) {
        return NaN;
      }

      return Number(valor);
    };

    if (
      req.query.buscar !== undefined &&
      typeof req.query.buscar !== "string"
    ) {
      res.status(400).json({
        error: "La búsqueda no es válida.",
      });
      return;
    }

    const resultado = await obtenerUsuariosDisponiblesOficinista(
      sesion.coopId,
      {
        buscar: req.query.buscar,
        pagina: leerEntero(req.query.pagina, 1),
        limite: leerEntero(req.query.limite, 10),
      }
    );

    res.status(200).json(resultado);
  } catch (error) {
    responderError(res, error);
  }
}
