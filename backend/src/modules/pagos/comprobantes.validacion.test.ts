import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { tipoReal, uuidValido } from "./comprobantes.validacion.js";

const UUID_A = "11111111-1111-4111-8111-111111111111";

describe("uuidValido", () => {
  it("acepta un uuid en minusculas o mayusculas", () => {
    assert.equal(uuidValido(UUID_A), true);
    assert.equal(uuidValido(UUID_A.toUpperCase()), true);
  });

  it("rechaza textos que no son uuid y valores que no son texto", () => {
    for (const valor of ["", "abc", `${UUID_A}x`, 123, null, undefined]) {
      assert.equal(uuidValido(valor), false);
    }
  });
});

describe("tipoReal", () => {
  it("reconoce JPG, PNG y PDF por su firma y no por el nombre", () => {
    const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const pdf = Buffer.from("%PDF-1.7\n", "latin1");
    assert.equal(tipoReal(jpg), "image/jpeg");
    assert.equal(tipoReal(png), "image/png");
    assert.equal(tipoReal(pdf), "application/pdf");
  });

  it("rechaza un archivo de texto renombrado como imagen", () => {
    assert.equal(tipoReal(Buffer.from("esto no es una imagen")), null);
  });

  it("rechaza archivos vacios o demasiado cortos", () => {
    assert.equal(tipoReal(Buffer.alloc(0)), null);
    assert.equal(tipoReal(Buffer.from([0xff, 0xd8, 0xff])), null);
  });
});
