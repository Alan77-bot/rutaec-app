
import assert from "node:assert/strict";
import { test } from "node:test";

const URL_API = "http://localhost:3000/api/administracion/resumen";

test("GET /api/administracion/resumen responde correctamente", async () => {
  const respuesta = await fetch(URL_API);

  assert.equal(respuesta.status, 200);

  const resultado = await respuesta.json() as {
    data: {
      totalCooperativas: number;
      cooperativasActivas: number;
      cooperativasInactivas: number;
      totalBuses: number;
      totalUsuarios: number;
    };
    message: string;
  };

  assert.ok(resultado.data);
  assert.equal(typeof resultado.message, "string");

  const indicadores = [
    "totalCooperativas",
    "cooperativasActivas",
    "cooperativasInactivas",
    "totalBuses",
    "totalUsuarios",
  ] as const;

  for (const indicador of indicadores) {
    assert.equal(typeof resultado.data[indicador], "number");
    assert.ok(resultado.data[indicador] >= 0);
  }

  assert.equal(
    resultado.data.cooperativasActivas +
      resultado.data.cooperativasInactivas,
    resultado.data.totalCooperativas,
  );
});
