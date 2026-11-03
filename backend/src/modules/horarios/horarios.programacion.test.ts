import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  diaIso,
  fechasDeOperacion,
  horariosParadas,
  instanteEnZona,
} from "./horarios.programacion.js";
import { validarGeneracion } from "./horarios.validacion.js";

const ZONA = "America/Guayaquil";
const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

describe("calculo de fechas y horas", () => {
  it("convierte la hora de Ecuador a UTC (UTC-5)", () => {
    const inicio = instanteEnZona("2026-11-02", "08:00", ZONA);
    assert.equal(inicio.toISOString(), "2026-11-02T13:00:00.000Z");
  });

  it("una salida de las 21:00 en Ecuador cae al dia siguiente en UTC", () => {
    const inicio = instanteEnZona("2026-11-02", "21:00", ZONA);
    assert.equal(inicio.toISOString(), "2026-11-03T02:00:00.000Z");
  });

  it("calcula el dia ISO (1 lunes, 7 domingo)", () => {
    assert.equal(diaIso("2026-11-02"), 1);
    assert.equal(diaIso("2026-11-08"), 7);
  });

  it("devuelve solo las fechas en que opera la frecuencia", () => {
    const fechas = fechasDeOperacion("2026-11-02", "2026-11-08", [1, 3, 5]);
    assert.deepEqual(fechas, ["2026-11-02", "2026-11-04", "2026-11-06"]);
  });

  it("incluye el ultimo dia del rango y cruza de mes", () => {
    const fechas = fechasDeOperacion("2026-11-29", "2026-12-01", [1, 2, 3, 4, 5, 6, 7]);
    assert.deepEqual(fechas, ["2026-11-29", "2026-11-30", "2026-12-01"]);
  });

  it("calcula llegada y salida de cada parada sin solaparse", () => {
    const inicio = new Date("2026-11-02T13:00:00.000Z");
    const h = horariosParadas(inicio, [
      { orden: 3, minutos_desde_origen: 210 },
      { orden: 1, minutos_desde_origen: 0 },
      { orden: 2, minutos_desde_origen: 60 },
    ]);
    assert.deepEqual(h.map((p) => p.orden), [1, 2, 3]);
    assert.equal(h[0].salida.toISOString(), "2026-11-02T13:00:00.000Z");
    assert.equal(h[1].llegada.toISOString(), "2026-11-02T14:00:00.000Z");
    assert.equal(h[1].salida.toISOString(), "2026-11-02T14:05:00.000Z");
    assert.equal(h[2].llegada.toISOString(), "2026-11-02T16:30:00.000Z");
    assert.equal(h[2].salida.getTime(), h[2].llegada.getTime());
  });

  it("acorta la espera si la siguiente parada esta muy cerca", () => {
    const inicio = new Date("2026-11-02T13:00:00.000Z");
    const h = horariosParadas(inicio, [
      { orden: 1, minutos_desde_origen: 0 },
      { orden: 2, minutos_desde_origen: 30 },
      { orden: 3, minutos_desde_origen: 32 },
    ]);
    assert.ok(h[1].salida <= h[2].llegada);
  });
});

describe("validarGeneracion", () => {
  const HOY = "2026-11-01";
  const valida = (cambios: Record<string, unknown> = {}) => ({
    frecuencia_id: UUID_A,
    bus_id: UUID_B,
    desde: "2026-11-02",
    hasta: "2026-11-08",
    fuente_normativa: "Tarifa de prueba",
    tarifas: [{ origen_orden: 1, destino_orden: 2, normal: 3.25, vip: 4 }],
    ...cambios,
  });

  it("acepta una solicitud correcta y usa 60 minutos de cierre por defecto", () => {
    const r = validarGeneracion(valida(), HOY);
    assert.equal(r.minutos_cierre, 60);
    assert.equal(r.tarifas[0].vip, 4);
  });

  it("rechaza ids invalidos", () => {
    assert.throws(() => validarGeneracion(valida({ bus_id: "x" }), HOY), /bus_id/);
  });

  it("rechaza fechas inexistentes, pasadas o invertidas", () => {
    assert.throws(() => validarGeneracion(valida({ desde: "2026-02-30" }), HOY), /fechas validas/);
    assert.throws(() => validarGeneracion(valida({ desde: "2026-10-30" }), HOY), /pasadas/);
    assert.throws(
      () => validarGeneracion(valida({ desde: "2026-11-05", hasta: "2026-11-04" }), HOY),
      /anterior/
    );
  });

  it("limita el rango a 31 dias", () => {
    assert.throws(() => validarGeneracion(valida({ hasta: "2026-12-10" }), HOY), /31 dias/);
  });

  it("valida las tarifas por tramo", () => {
    assert.throws(() => validarGeneracion(valida({ tarifas: [] }), HOY), /al menos una tarifa/);
    assert.throws(
      () => validarGeneracion(valida({ tarifas: [{ origen_orden: 2, destino_orden: 1, normal: 3 }] }), HOY),
      /origen_orden/
    );
    assert.throws(
      () => validarGeneracion(valida({ tarifas: [{ origen_orden: 1, destino_orden: 2, normal: 0 }] }), HOY),
      /mayor que 0/
    );
    assert.throws(
      () => validarGeneracion(valida({ tarifas: [{ origen_orden: 1, destino_orden: 2, normal: 3.255 }] }), HOY),
      /2 decimales/
    );
    const repetidas = [
      { origen_orden: 1, destino_orden: 2, normal: 3 },
      { origen_orden: 1, destino_orden: 2, normal: 4 },
    ];
    assert.throws(() => validarGeneracion(valida({ tarifas: repetidas }), HOY), /repetido/);
  });

  it("exige la fuente normativa y un cierre de ventas valido", () => {
    assert.throws(() => validarGeneracion(valida({ fuente_normativa: " " }), HOY), /fuente normativa/);
    assert.throws(() => validarGeneracion(valida({ minutos_cierre: -5 }), HOY), /minutos_cierre/);
  });
});
