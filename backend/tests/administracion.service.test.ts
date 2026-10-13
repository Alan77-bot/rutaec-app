
import assert from "node:assert/strict";
import { test } from "node:test";

import { obtenerResumenAdministracion } from "../src/modules/administracion/administracion.service.js";

test("El resumen administrativo devuelve cinco indicadores numéricos", async () => {
  const resumen = await obtenerResumenAdministracion();

  const indicadores = [
    "totalCooperativas",
    "cooperativasActivas",
    "cooperativasInactivas",
    "totalBuses",
    "totalUsuarios",
  ] as const;

  for (const indicador of indicadores) {
    assert.equal(typeof resumen[indicador], "number");
    assert.ok(resumen[indicador] >= 0);
  }

  assert.equal(
    resumen.cooperativasActivas + resumen.cooperativasInactivas,
    resumen.totalCooperativas,
  );
});
