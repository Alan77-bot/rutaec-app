
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Request, Response } from "express";
import {
  crearCooperativa,
  editarCooperativa,
  actualizarEstadoCooperativa,
} from "./cooperativas.controller.js";

function respuestaFalsa() {
  const registro: {
    estado?: number;
    cuerpo?: { error?: string };
  } = {};

  const res = {
    status(estado: number) {
      registro.estado = estado;
      return res;
    },
    json(cuerpo: { error?: string }) {
      registro.cuerpo = cuerpo;
      return res;
    },
  };

  return {
    res: res as unknown as Response,
    registro,
  };
}

const ID_VALIDO = "550e8400-e29b-41d4-a716-446655440000";

describe("validaciones de cooperativas", () => {
  it("rechaza un registro sin datos", async () => {
    const { res, registro } = respuestaFalsa();

    await crearCooperativa(
      { body: undefined } as Request,
      res
    );

    assert.equal(registro.estado, 400);
  });

  it("rechaza un RUC incorrecto", async () => {
    const { res, registro } = respuestaFalsa();

    await crearCooperativa(
      {
        body: {
          ruc: "123",
          razon_social: "Cooperativa Prueba",
          nombre_comercial: "Prueba",
          correo: "prueba@correo.com",
          telefono: "0999999999",
          direccion: "Guayaquil",
        },
      } as Request,
      res
    );

    assert.equal(registro.estado, 400);
    assert.match(registro.cuerpo?.error ?? "", /RUC/);
  });

  it("rechaza editar campos no permitidos", async () => {
    const { res, registro } = respuestaFalsa();

    await editarCooperativa(
      {
        params: { id: ID_VALIDO },
        body: { ruc: "1234567890001" },
      } as unknown as Request,
      res
    );

    assert.equal(registro.estado, 400);
  });

  it("rechaza estados que no sean booleanos", async () => {
    const { res, registro } = respuestaFalsa();

    await actualizarEstadoCooperativa(
      {
        params: { id: ID_VALIDO },
        body: { activa: "true" },
      } as unknown as Request,
      res
    );

    assert.equal(registro.estado, 400);
  });
});
