
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

import app from "../../app.js";

describe("Gerentes - seguridad HTTP", () => {
  let servidor: Server;
  let baseUrl: string;

  before(async () => {
    servidor = app.listen(0);

    await new Promise<void>((resolve, reject) => {
      if (servidor.listening) {
        resolve();
        return;
      }

      servidor.once("listening", resolve);
      servidor.once("error", reject);
    });

    const direccion = servidor.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${direccion.port}`;
  });

  after(async () => {
    if (!servidor) return;

    await new Promise<void>((resolve, reject) => {
      servidor.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  });

  const rutas = [
    {
      nombre: "Listar gerentes",
      metodo: "GET",
      ruta: "/api/gerentes",
    },
    {
      nombre: "Listar usuarios disponibles",
      metodo: "GET",
      ruta: "/api/gerentes/usuarios-disponibles",
    },
    {
      nombre: "Crear gerente",
      metodo: "POST",
      ruta: "/api/gerentes",
    },
    {
      nombre: "Asignar usuario existente",
      metodo: "POST",
      ruta: "/api/gerentes/asignar-existente",
    },
    {
      nombre: "Editar gerente",
      metodo: "PATCH",
      ruta: "/api/gerentes/11111111-1111-4111-8111-111111111111",
    },
    {
      nombre: "Cambiar estado de gerente",
      metodo: "PATCH",
      ruta: "/api/gerentes/11111111-1111-4111-8111-111111111111/estado",
    },
  ];

  for (const prueba of rutas) {
    it(`${prueba.nombre}: devuelve 401 sin sesión`, async () => {
      const respuesta = await fetch(`${baseUrl}${prueba.ruta}`, {
        method: prueba.metodo,
        headers: {
          "Content-Type": "application/json",
        },
        ...(
          prueba.metodo === "GET"
            ? {}
            : { body: JSON.stringify({}) }
        ),
      });

      assert.equal(
        respuesta.status,
        401,
        `${prueba.metodo} ${prueba.ruta} debería devolver 401`
      );
    });

    it(`${prueba.nombre}: no acepta token inventado`, async () => {
      const respuesta = await fetch(`${baseUrl}${prueba.ruta}`, {
        method: prueba.metodo,
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token-invalido-de-prueba",
        },
        ...(
          prueba.metodo === "GET"
            ? {}
            : { body: JSON.stringify({}) }
        ),
      });

      assert.equal(
        respuesta.status,
        401,
        `${prueba.metodo} ${prueba.ruta} debería rechazar el token`
      );
    });
  }

  it("No permite consultar gerentes con un ID de sesión inventado", async () => {
    const respuesta = await fetch(`${baseUrl}/api/gerentes`, {
      headers: {
        Authorization: "Bearer 00000000-0000-0000-0000-000000000000",
      },
    });

    assert.equal(respuesta.status, 401);
  });

  it("No expone información sensible en un error de autenticación", async () => {
    const respuesta = await fetch(`${baseUrl}/api/gerentes`);

    assert.equal(respuesta.status, 401);

    const contenido = await respuesta.text();

    assert.doesNotMatch(
      contenido,
      /password_hash|contrasena_hash|DATABASE_URL|POSTGRES_PASSWORD/i
    );
  });
});
