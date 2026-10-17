import type { Response } from "express";

export type CodigoError =
  | "PARAMETROS_INVALIDOS"
  | "FECHA_INVALIDA"
  | "FECHA_PASADA"
  | "NO_ENCONTRADO"
  | "NO_AUTORIZADO"
  | "PROHIBIDO"
  | "CONFLICTO"
  | "ERROR_INTERNO";

export type RespuestaExitosa<T> = {
  data: T;
  message: string;
};

export type RespuestaError = {
  error: string;
  code: CodigoError;
};

export function enviarExito<T>(
  res: Response,
  data: T,
  message = "Operacion correcta",
  estado = 200
): void {
  const cuerpo: RespuestaExitosa<T> = { data, message };
  res.status(estado).json(cuerpo);
}

export function enviarError(
  res: Response,
  estado: number,
  error: string,
  code: CodigoError
): void {
  const cuerpo: RespuestaError = { error, code };
  res.status(estado).json(cuerpo);
}
