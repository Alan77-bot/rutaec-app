
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request, Response } from "express";

import {
  editarCooperativa,
  actualizarEstadoCooperativa,
} from "../src/modules/cooperativas/cooperativas.controller.js";

const ID_VALIDO = "3b461dec-d7ce-4665-917f-ef3e043fa64e";

async function probarControlador(
  controlador: (req: Request, res: Response) => Promise<void>,
  id: string,
  body: unknown
) {
  let estado = 200;
  let resultado: unknown = null;

  const req = {
    params: { id },
    body,
  } as unknown as Request;

  const res = {
    status(codigo: number) {
      estado = codigo;
      return this;
    },
    json(datos: unknown) {
      resultado = datos;
      return this;
    },
  } as Response;

  await controlador(req, res);

  return { estado, resultado };
}

test("Rechaza actualizar una cooperativa con UUID inválido", async () => {
  const respuesta = await probarControlador(
    editarCooperativa,
    "id-invalido",
    { nombre_comercial: "Nueva cooperativa" }
  );

  assert.equal(respuesta.estado, 400);
});

test("Rechaza actualizar campos no permitidos", async () => {
  const respuesta = await probarControlador(
    editarCooperativa,
    ID_VALIDO,
    { activa: false }
  );

  assert.equal(respuesta.estado, 400);
});

test("Rechaza actualizar una cooperativa sin datos", async () => {
  const respuesta = await probarControlador(
    editarCooperativa,
    ID_VALIDO,
    {}
  );

  assert.equal(respuesta.estado, 400);
});

test("Rechaza un correo inválido al actualizar", async () => {
  const respuesta = await probarControlador(
    editarCooperativa,
    ID_VALIDO,
    { correo: "correo-invalido" }
  );

  assert.equal(respuesta.estado, 400);
});

test("Rechaza cambiar estado con UUID inválido", async () => {
  const respuesta = await probarControlador(
    actualizarEstadoCooperativa,
    "id-invalido",
    { activa: true }
  );

  assert.equal(respuesta.estado, 400);
});

test("Rechaza un estado que no sea booleano", async () => {
  const respuesta = await probarControlador(
    actualizarEstadoCooperativa,
    ID_VALIDO,
    { activa: "true" }
  );

  assert.equal(respuesta.estado, 400);
});

test("Rechaza cambiar estado sin enviar activa", async () => {
  const respuesta = await probarControlador(
    actualizarEstadoCooperativa,
    ID_VALIDO,
    {}
  );

  assert.equal(respuesta.estado, 400);
});
