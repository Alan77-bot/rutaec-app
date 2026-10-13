
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request, Response } from "express";

import { crearCooperativa } from "../src/modules/cooperativas/cooperativas.controller.js";

async function probarSolicitud(body: unknown) {
  let estado = 200;
  let resultado: unknown = null;

  const req = { body } as Request;

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

  await crearCooperativa(req, res);

  return { estado, resultado };
}

test("Rechaza el registro sin datos", async () => {
  const respuesta = await probarSolicitud(null);

  assert.equal(respuesta.estado, 400);
});

test("Rechaza campos obligatorios vacíos", async () => {
  const respuesta = await probarSolicitud({
    ruc: "",
    razon_social: "Cooperativa de Prueba",
    nombre_comercial: "Ruta Prueba",
    correo: "prueba@rutaec.com",
    telefono: "0999999999",
    direccion: "Ambato",
  });

  assert.equal(respuesta.estado, 400);
});

test("Rechaza un RUC con formato incorrecto", async () => {
  const respuesta = await probarSolicitud({
    ruc: "12345",
    razon_social: "Cooperativa de Prueba",
    nombre_comercial: "Ruta Prueba",
    correo: "prueba@rutaec.com",
    telefono: "0999999999",
    direccion: "Ambato",
  });

  assert.equal(respuesta.estado, 400);
});

test("Rechaza un correo inválido", async () => {
  const respuesta = await probarSolicitud({
    ruc: "1790012345001",
    razon_social: "Cooperativa de Prueba",
    nombre_comercial: "Ruta Prueba",
    correo: "correo-invalido",
    telefono: "0999999999",
    direccion: "Ambato",
  });

  assert.equal(respuesta.estado, 400);
});
