import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  leerCampos,
  tipoReal,
  uuidValido,
} from "./comprobantes.validacion.js";
import { ErrorPago } from "./errores.js";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";
const UUID_C = "33333333-3333-4333-8333-333333333333";

function campos(cambios: Record<string, unknown> = {}) {
  return {
    compra_id: UUID_A,
    cuenta_bancaria_id: UUID_B,
    clave_idempotencia: UUID_C,
    metodo: "TRANSFERENCIA",
    numero_referencia: "  REF-12345  ",
    fecha_operacion: "2026-10-20",
    importe_declarado: "12.5",
    ...cambios,
  };
}

function esperaError(fn: () => unknown, estado: number, mensaje: RegExp) {
  assert.throws(fn, (error: unknown) => {
    assert.ok(error instanceof ErrorPago);
    assert.equal(error.estado, estado);
    assert.match(error.message, mensaje);
    return true;
  });
}

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

describe("leerCampos", () => {
  it("acepta un formulario correcto y normaliza referencia e importe", () => {
    const r = leerCampos(campos());
    assert.equal(r.compraId, UUID_A);
    assert.equal(r.cuentaId, UUID_B);
    assert.equal(r.idempotencia, UUID_C);
    assert.equal(r.metodo, "TRANSFERENCIA");
    assert.equal(r.numero, "REF-12345");
    assert.equal(r.fechaTexto, "2026-10-20");
    assert.equal(r.importe, "12.50");
  });

  it("acepta el metodo DEPOSITO", () => {
    assert.equal(leerCampos(campos({ metodo: "DEPOSITO" })).metodo, "DEPOSITO");
  });

  it("rechaza identificadores invalidos", () => {
    esperaError(() => leerCampos(campos({ compra_id: "1" })), 400, /compra_id/);
    esperaError(() => leerCampos(campos({ cuenta_bancaria_id: "" })), 400, /cuenta_bancaria_id/);
    esperaError(() => leerCampos(campos({ clave_idempotencia: undefined })), 400, /clave_idempotencia/);
  });

  it("rechaza metodos distintos de DEPOSITO o TRANSFERENCIA", () => {
    esperaError(() => leerCampos(campos({ metodo: "TARJETA" })), 400, /metodo/);
    esperaError(() => leerCampos(campos({ metodo: undefined })), 400, /metodo/);
  });

  it("rechaza referencias demasiado cortas o largas", () => {
    esperaError(() => leerCampos(campos({ numero_referencia: " 12 " })), 400, /numero_referencia/);
    esperaError(() => leerCampos(campos({ numero_referencia: "9".repeat(41) })), 400, /numero_referencia/);
  });

  it("rechaza fechas mal escritas, inexistentes o futuras", () => {
    esperaError(() => leerCampos(campos({ fecha_operacion: "20/10/2026" })), 400, /AAAA-MM-DD/);
    esperaError(() => leerCampos(campos({ fecha_operacion: "2026-02-30" })), 400, /AAAA-MM-DD/);
    esperaError(() => leerCampos(campos({ fecha_operacion: "2999-01-01" })), 400, /futura/);
  });

  it("rechaza importes vacios, negativos, cero o excesivos", () => {
    for (const importe of ["", "abc", "0", "-5", "100000000"]) {
      esperaError(() => leerCampos(campos({ importe_declarado: importe })), 400, /importe_declarado/);
    }
  });
});
