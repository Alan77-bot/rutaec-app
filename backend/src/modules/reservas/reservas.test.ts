import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { enviarError, enviarExito } from "../../utils/respuestas.js";
import { validarBusqueda } from "./reservas.validaciones.js";

const ZONA_HORARIA = "America/Guayaquil";
const RUC_DATOS_PRUEBA = "9990000000001";

function fechaEcuador(diasDesdeHoy: number): string {
  const ms = Date.now() + diasDesdeHoy * 24 * 60 * 60 * 1000;
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_HORARIA }).format(ms);
}

function respuestaFalsa() {
  const registro: { estado?: number; cuerpo?: unknown } = {};
  const res = {
    status(estado: number) {
      registro.estado = estado;
      return res;
    },
    json(cuerpo: unknown) {
      registro.cuerpo = cuerpo;
      return res;
    },
  };
  return { res: res as never, registro };
}

describe("validarBusqueda", () => {
  const manana = fechaEcuador(1);

  it("acepta parametros validos y recorta espacios", () => {
    const r = validarBusqueda({ origen: " Ambato ", destino: "Quito", fecha: manana });
    assert.deepEqual(r, {
      ok: true,
      datos: { origen: "Ambato", destino: "Quito", fecha: manana },
    });
  });

  it("rechaza parametros faltantes", () => {
    const r = validarBusqueda({ origen: "Ambato", destino: "Quito" });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.falla.code, "PARAMETROS_INVALIDOS");
  });

  it("rechaza origen igual al destino sin importar mayusculas", () => {
    const r = validarBusqueda({ origen: "Ambato", destino: "ambato", fecha: manana });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.falla.code, "PARAMETROS_INVALIDOS");
  });

  it("rechaza una fecha que no existe", () => {
    const r = validarBusqueda({ origen: "Ambato", destino: "Quito", fecha: "2099-02-31" });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.falla.code, "FECHA_INVALIDA");
  });

  it("rechaza una fecha con formato incorrecto", () => {
    const r = validarBusqueda({ origen: "Ambato", destino: "Quito", fecha: "20/10/2026" });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.falla.code, "FECHA_INVALIDA");
  });

  it("rechaza una fecha pasada pero acepta la de hoy", () => {
    const pasada = validarBusqueda({ origen: "Ambato", destino: "Quito", fecha: fechaEcuador(-1) });
    assert.equal(pasada.ok, false);
    if (!pasada.ok) assert.equal(pasada.falla.code, "FECHA_PASADA");

    const hoy = validarBusqueda({ origen: "Ambato", destino: "Quito", fecha: fechaEcuador(0) });
    assert.equal(hoy.ok, true);
  });

  it("rechaza parametros repetidos y textos demasiado largos", () => {
    const repetido = validarBusqueda({ origen: ["Ambato", "Loja"], destino: "Quito", fecha: manana });
    assert.equal(repetido.ok, false);

    const largo = validarBusqueda({ origen: "A".repeat(81), destino: "Quito", fecha: manana });
    assert.equal(largo.ok, false);
  });
});

describe("respuestas del modulo", () => {
  it("enviarExito responde con data y message", () => {
    const { res, registro } = respuestaFalsa();
    enviarExito(res, [1, 2]);
    assert.equal(registro.estado, 200);
    assert.deepEqual(registro.cuerpo, { data: [1, 2], message: "Operacion correcta" });
  });

  it("enviarError responde con error y code", () => {
    const { res, registro } = respuestaFalsa();
    enviarError(res, 409, "Asiento ocupado", "CONFLICTO");
    assert.equal(registro.estado, 409);
    assert.deepEqual(registro.cuerpo, { error: "Asiento ocupado", code: "CONFLICTO" });
  });
});

// Pruebas contra la API y PostgreSQL reales. Se omiten si no hay base de datos
// o si no se cargaron los datos de prueba (database/scripts/datos_prueba_viajes.sql).
describe("GET /api/reservas/viajes", () => {
  let servidor: Server | undefined;
  let base = "";
  let desconectar: (() => Promise<void>) | undefined;
  let motivoOmision: string | undefined;

  before(async () => {
    try {
      const { prisma } = await import("../../lib/prisma.js");
      desconectar = () => prisma.$disconnect();

      const filas = await prisma.$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS n FROM rutaec.cooperativas WHERE ruc = ${RUC_DATOS_PRUEBA}`;
      if (!filas[0] || filas[0].n === 0) {
        motivoOmision = "faltan los datos de prueba de viajes";
        return;
      }

      const { default: app } = await import("../../app.js");
      servidor = app.listen(0);
      base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
    } catch {
      motivoOmision = "no hay conexion con la base de datos";
    }
  });

  after(async () => {
    servidor?.close();
    await desconectar?.();
  });

  const buscar = (origen: string, destino: string, fecha: string) =>
    fetch(`${base}/api/reservas/viajes?origen=${origen}&destino=${destino}&fecha=${fecha}`);

  it("responde 400 con code cuando falta la fecha", async (t) => {
    if (motivoOmision) return t.skip(motivoOmision);
    const r = await fetch(`${base}/api/reservas/viajes?origen=Ambato&destino=Quito`);
    assert.equal(r.status, 400);
    assert.equal(((await r.json()) as { code: string }).code, "PARAMETROS_INVALIDOS");
  });

  it("lista los viajes de Ambato a Quito con cupos y tarifas del tramo", async (t) => {
    if (motivoOmision) return t.skip(motivoOmision);
    const r = await buscar("Ambato", "Quito", fechaEcuador(1));
    assert.equal(r.status, 200);

    const { data } = (await r.json()) as {
      data: { salida: string; cupos_disponibles: number; tarifas: unknown[] }[];
    };
    assert.ok(data.length >= 2, "debe haber al menos un viaje por cooperativa");
    for (const viaje of data) {
      assert.equal(typeof viaje.cupos_disponibles, "number");
      assert.ok(viaje.tarifas.length >= 2, "tarifa NORMAL y VIP");
    }
    const salidas = data.map((v) => Date.parse(v.salida));
    assert.deepEqual(salidas, [...salidas].sort((a, b) => a - b));
  });

  it("no devuelve viajes en el sentido contrario", async (t) => {
    if (motivoOmision) return t.skip(motivoOmision);
    const r = await buscar("Quito", "Ambato", fechaEcuador(1));
    assert.equal(r.status, 200);
    assert.deepEqual(((await r.json()) as { data: unknown[] }).data, []);
  });

  it("usa la tarifa del tramo completo Riobamba a Quito", async (t) => {
    if (motivoOmision) return t.skip(motivoOmision);
    const r = await buscar("Riobamba", "Quito", fechaEcuador(1));
    const { data } = (await r.json()) as {
      data: { tarifas: { categoria: string; importe: number }[] }[];
    };
    assert.equal(data.length, 1);
    const normal = data[0]!.tarifas.find((x) => x.categoria === "NORMAL");
    assert.equal(normal?.importe, 5);
  });

  it("lista las ciudades con viajes disponibles ordenadas por nombre", async (t) => {
    if (motivoOmision) return t.skip(motivoOmision);
    const r = await fetch(`${base}/api/reservas/ciudades`);
    assert.equal(r.status, 200);

    const { data } = (await r.json()) as {
      data: { nombre: string; provincia: string }[];
    };
    const nombres = data.map((c) => c.nombre);
    for (const esperada of ["Ambato", "Quito", "Riobamba"]) {
      assert.ok(nombres.includes(esperada), `falta ${esperada}`);
    }
    assert.deepEqual(nombres, [...nombres].sort((a, b) => a.localeCompare(b, "es")));
    assert.equal(new Set(nombres).size, nombres.length, "sin ciudades repetidas");
  });
});
