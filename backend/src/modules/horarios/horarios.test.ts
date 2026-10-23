import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validarFrecuencia } from "./horarios.validacion.js";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

function valida(cambios: Record<string, unknown> = {}) {
  return {
    codigo: " UIO-AMB-0600 ",
    ruta_id: UUID_A,
    resolucion_id: UUID_B,
    hora_salida: "06:00",
    dias: [5, 1, 3],
    ...cambios,
  };
}

describe("validarFrecuencia", () => {
  it("acepta una frecuencia correcta y ordena los dias", () => {
    const r = validarFrecuencia(valida());
    assert.equal(r.codigo, "UIO-AMB-0600");
    assert.deepEqual(r.dias, [1, 3, 5]);
    assert.equal(r.hora_salida, "06:00");
  });

  it("rechaza un cuerpo que no es un objeto", () => {
    assert.throws(() => validarFrecuencia(null), /no es valido/);
  });

  it("rechaza un codigo vacio", () => {
    assert.throws(() => validarFrecuencia(valida({ codigo: "  " })), /codigo/);
  });

  it("rechaza ids que no son UUID", () => {
    assert.throws(() => validarFrecuencia(valida({ ruta_id: "abc" })), /ruta_id/);
    assert.throws(
      () => validarFrecuencia(valida({ resolucion_id: 5 })),
      /resolucion_id/
    );
  });

  it("rechaza horas con formato incorrecto", () => {
    for (const hora of ["6:00", "24:00", "12:60", "mediodia", 600]) {
      assert.throws(
        () => validarFrecuencia(valida({ hora_salida: hora })),
        /hora_salida/
      );
    }
  });

  it("rechaza dias vacios, fuera de rango o repetidos", () => {
    assert.throws(() => validarFrecuencia(valida({ dias: [] })), /al menos un dia/);
    assert.throws(() => validarFrecuencia(valida({ dias: [0] })), /lunes/);
    assert.throws(() => validarFrecuencia(valida({ dias: [8] })), /lunes/);
    assert.throws(() => validarFrecuencia(valida({ dias: [1.5] })), /lunes/);
    assert.throws(() => validarFrecuencia(valida({ dias: [2, 2] })), /repetirse/);
  });

  it("exige que activa sea booleano cuando se envia", () => {
    assert.equal(validarFrecuencia(valida({ activa: false })).activa, false);
    assert.throws(() => validarFrecuencia(valida({ activa: "si" })), /activa/);
  });
});
