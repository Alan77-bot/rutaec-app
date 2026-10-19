import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { contenidoQr, extraerToken } from "./boletos.qr.js";
import { evaluarBoleto, puedeVerificar } from "./boletos.verificacion.js";
import type { DatosEmision } from "./boletos.service.js";

const TOKEN = "2801b8f0-888f-4ea4-9d0b-36b85ab39eed";

const datos = (salida: string, llegada: string): DatosEmision => ({
  cooperativa: "Prueba",
  pasajero: { nombres: "Ana", apellidos: "Cliente" },
  asiento: { numero: "12" },
  origen: "Quito",
  destino: "Loja",
  salida,
  llegada,
  precio_base: 10,
  descuento: 0,
  importe: 10,
  moneda: "USD",
});

const ahora = new Date("2026-11-02T18:00:00-05:00");

const fila = (cambios: Partial<Parameters<typeof evaluarBoleto>[0]> = {}) => ({
  id: "b1",
  codigo: "c1",
  estado: "EMITIDO",
  cooperativa_id: "coop-1",
  viaje_id: "viaje-1",
  viaje_estado: "PUBLICADO",
  datos_emision: datos("2026-11-02T20:00:00-05:00", "2026-11-03T07:30:00-05:00"),
  abordado_en: null,
  ...cambios,
});

describe("contenido del QR", () => {
  it("solo lleva el prefijo y el token, sin datos personales", () => {
    assert.equal(contenidoQr(TOKEN), `RUTAEC:${TOKEN}`);
  });

  it("extrae el token de un QR de RutaEC", () => {
    assert.equal(extraerToken(`RUTAEC:${TOKEN}`), TOKEN);
    assert.equal(extraerToken(`  RUTAEC:${TOKEN.toUpperCase()}  `), TOKEN);
  });

  it("rechaza códigos alterados o de otro formato", () => {
    assert.equal(extraerToken(TOKEN), null);
    assert.equal(extraerToken(`OTRO:${TOKEN}`), null);
    assert.equal(extraerToken(`RUTAEC:${TOKEN}x`), null);
    assert.equal(extraerToken(`RUTAEC:${TOKEN.slice(0, -1)}`), null);
    assert.equal(extraerToken("RUTAEC:"), null);
    assert.equal(extraerToken("RUTAEC:'; DROP TABLE boletos;--"), null);
    assert.equal(extraerToken(undefined), null);
    assert.equal(extraerToken(12345), null);
  });
});

describe("evaluación del boleto", () => {
  it("acepta un boleto emitido dentro del horario", () => {
    assert.equal(evaluarBoleto(fila(), undefined, ahora), "VALIDO");
  });

  it("rechaza un boleto anulado", () => {
    assert.equal(evaluarBoleto(fila({ estado: "ANULADO" }), undefined, ahora), "ANULADO");
  });

  it("rechaza un boleto que ya abordó", () => {
    assert.equal(evaluarBoleto(fila({ abordado_en: new Date() }), undefined, ahora), "YA_ABORDADO");
  });

  it("rechaza un boleto de otro viaje", () => {
    assert.equal(evaluarBoleto(fila(), "viaje-2", ahora), "VIAJE_INCORRECTO");
    assert.equal(evaluarBoleto(fila(), "viaje-1", ahora), "VALIDO");
  });

  it("rechaza un viaje cancelado", () => {
    assert.equal(evaluarBoleto(fila({ viaje_estado: "CANCELADO" }), undefined, ahora), "VIAJE_CANCELADO");
  });

  it("rechaza fuera de horario: muy temprano o ya terminado", () => {
    assert.equal(evaluarBoleto(fila(), undefined, new Date("2026-11-02T10:00:00-05:00")), "FUERA_DE_HORARIO");
    assert.equal(evaluarBoleto(fila(), undefined, new Date("2026-11-03T09:00:00-05:00")), "FUERA_DE_HORARIO");
  });

  it("acepta desde 3 horas antes de la salida", () => {
    assert.equal(evaluarBoleto(fila(), undefined, new Date("2026-11-02T17:00:00-05:00")), "VALIDO");
    assert.equal(evaluarBoleto(fila(), undefined, new Date("2026-11-02T16:59:00-05:00")), "FUERA_DE_HORARIO");
  });
});

describe("quién puede verificar", () => {
  it("el administrador y el personal de la cooperativa dueña, sí", () => {
    assert.equal(puedeVerificar({ id: "u", rol: "admin", coopId: null }, "coop-1"), true);
    assert.equal(puedeVerificar({ id: "u", rol: "oficinista", coopId: "coop-1" }, "coop-1"), true);
    assert.equal(puedeVerificar({ id: "u", rol: "cooperativa", coopId: "coop-1" }, "coop-1"), true);
  });

  it("clientes y personal de otra cooperativa, no", () => {
    assert.equal(puedeVerificar({ id: "u", rol: "usuario", coopId: null }, "coop-1"), false);
    assert.equal(puedeVerificar({ id: "u", rol: "oficinista", coopId: "coop-2" }, "coop-1"), false);
  });
});
