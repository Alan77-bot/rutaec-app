import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { resumirAsientos } from "./reservas.asientos.js";
import { validarDisponibilidad } from "./reservas.validaciones.js";

const ZONA_HORARIA = "America/Guayaquil";
const RUC_DATOS_PRUEBA = "9990000000001";
const CORREO_DATOS_PRUEBA = "prueba.datos@rutaec.test";
const VIAJE_VALIDO = "5714bd7f-2331-4b53-860b-66ec8d030303";

function fechaEcuador(diasDesdeHoy: number): string {
  const ms = Date.now() + diasDesdeHoy * 24 * 60 * 60 * 1000;
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_HORARIA }).format(ms);
}

// Marca para deshacer la transaccion de una prueba sin tratarla como un fallo.
class Deshacer extends Error {}

describe("validarDisponibilidad", () => {
  it("acepta un viaje y dos ciudades distintas, recortando espacios", () => {
    const r = validarDisponibilidad({ viajeId: VIAJE_VALIDO, origen: " Ambato ", destino: "Quito" });
    assert.deepEqual(r, {
      ok: true,
      datos: { viajeId: VIAJE_VALIDO, origen: "Ambato", destino: "Quito" },
    });
  });

  it("rechaza parametros faltantes", () => {
    const r = validarDisponibilidad({ origen: "Ambato" });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.falla.code, "PARAMETROS_INVALIDOS");
  });

  it("rechaza un identificador que no es un uuid", () => {
    const r = validarDisponibilidad({ viajeId: "abc", origen: "Ambato", destino: "Quito" });
    assert.equal(r.ok, false);
  });

  it("rechaza origen igual al destino y textos demasiado largos", () => {
    assert.equal(
      validarDisponibilidad({ viajeId: VIAJE_VALIDO, origen: "Ambato", destino: "ambato" }).ok,
      false
    );
    assert.equal(
      validarDisponibilidad({ viajeId: VIAJE_VALIDO, origen: "A".repeat(81), destino: "Quito" }).ok,
      false
    );
  });
});

// Pruebas contra la base de datos real. Se omiten si no hay conexion o si no se
// cargaron los datos de prueba (database/scripts/datos_prueba_viajes.sql).
describe("disponibilidad de asientos", () => {
  let servidor: Server | undefined;
  let base = "";
  let motivoOmision: string | undefined;
  let viajeId = "";
  let prisma: (typeof import("../../lib/prisma.js"))["prisma"];
  let servicios: typeof import("./reservas.asientos.js");

  before(async () => {
    try {
      ({ prisma } = await import("../../lib/prisma.js"));
      servicios = await import("./reservas.asientos.js");
      const { buscarViajes } = await import("./reservas.service.js");

      const filas = await prisma.$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS n FROM rutaec.cooperativas WHERE ruc = ${RUC_DATOS_PRUEBA}`;
      if (!filas[0] || filas[0].n === 0) {
        motivoOmision = "faltan los datos de prueba de viajes";
        return;
      }

      const viajes = await buscarViajes({
        origen: "Ambato",
        destino: "Quito",
        fecha: fechaEcuador(2),
      });
      const andes = viajes.find((v) => v.cooperativa.nombre.startsWith("Andes"));
      if (!andes) {
        motivoOmision = "no hay viajes de prueba para dentro de dos dias (vuelve a ejecutar el script)";
        return;
      }
      viajeId = andes.viaje_id;

      const { default: app } = await import("../../app.js");
      servidor = app.listen(0);
      base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/api/reservas`;
    } catch {
      motivoOmision = "no hay conexion con la base de datos";
    }
  });

  after(async () => {
    servidor?.close();
    await prisma?.$disconnect();
  });

  it("devuelve los 40 asientos con su categoria, estado y precio del tramo", async (t) => {
    if (motivoOmision) return t.skip(motivoOmision);
    const d = await servicios.obtenerDisponibilidad(viajeId, "Ambato", "Quito");
    assert.ok(d);
    assert.equal(d.asientos.length, 40);

    const vip = d.asientos.find((a) => a.categoria === "VIP");
    const normal = d.asientos.find((a) => a.categoria === "NORMAL");
    assert.equal(vip?.precio, 4.5);
    assert.equal(normal?.precio, 3.5);
    assert.ok(d.asientos.every((a) => a.estado === "LIBRE"));
    assert.equal(d.viaje.cupos_disponibles, 40);
  });

  it("usa la tarifa del tramo completo cuando el pasajero sube en Riobamba", async (t) => {
    if (motivoOmision) return t.skip(motivoOmision);
    const d = await servicios.obtenerDisponibilidad(viajeId, "Riobamba", "Quito");
    assert.ok(d);
    assert.equal(d.asientos.find((a) => a.categoria === "NORMAL")?.precio, 5);
    assert.equal(d.viaje.paradas.length, 3);
  });

  it("devuelve null si el viaje no existe o el recorrido no corresponde", async (t) => {
    if (motivoOmision) return t.skip(motivoOmision);
    const inexistente = "00000000-0000-0000-0000-000000000000";
    assert.equal(await servicios.obtenerDisponibilidad(inexistente, "Ambato", "Quito"), null);
    assert.equal(await servicios.obtenerDisponibilidad(viajeId, "Quito", "Ambato"), null);
    assert.equal(await servicios.obtenerDisponibilidad(viajeId, "Ambato", "Loja"), null);
  });

  it("marca los asientos retenidos y ocupados solo en los tramos que se cruzan", async (t) => {
    if (motivoOmision) return t.skip(motivoOmision);
    const estados: Record<string, string> = {};

    try {
      await prisma.$transaction(async (tx) => {
        const [{ uid }] = await tx.$queryRaw<{ uid: string }[]>`
          SELECT id::text AS uid FROM rutaec.usuarios WHERE correo = ${CORREO_DATOS_PRUEBA}`;
        await tx.$queryRaw`SELECT set_config('app.usuario_id', ${uid}, true)`;

        const antes = await servicios.obtenerDisponibilidad(viajeId, "Ambato", "Quito", tx);
        const numero = antes!.asientos.find((a) => a.categoria === "NORMAL")!.numero;

        await tx.$queryRaw`
          INSERT INTO rutaec.pasajeros(comprador_id, nombres, apellidos, fecha_nacimiento,
                                       tipo_documento, numero_documento)
          VALUES (${uid}::uuid, 'Ana', 'Prueba', DATE '1990-01-01', 'CEDULA', 'T-DISP-01')`;

        const [{ compra }] = await tx.$queryRaw<{ compra: string }[]>`
          SELECT rutaec.reservar_compra(${uid}::uuid, ${viajeId}::uuid, (
            SELECT jsonb_build_array(jsonb_build_object(
              'pasajero_id', p.id, 'asiento_id', s.id, 'tarifa_id', tf.id))
            FROM rutaec.pasajeros p, rutaec.asientos_viaje s, rutaec.tarifas_viaje tf
            WHERE p.numero_documento = 'T-DISP-01' AND p.comprador_id = ${uid}::uuid
              AND s.viaje_id = ${viajeId}::uuid AND s.numero = ${numero}
              AND tf.viaje_id = ${viajeId}::uuid AND tf.origen_orden = 2
              AND tf.destino_orden = 3 AND tf.categoria = 'NORMAL'
          ))::text AS compra`;

        const estadoDe = async (origen: string, destino: string) => {
          const d = await servicios.obtenerDisponibilidad(viajeId, origen, destino, tx);
          return d!.asientos.find((a) => a.numero === numero)!.estado;
        };

        estados.retenidoEnSuTramo = await estadoDe("Ambato", "Quito");
        estados.libreEnOtroTramo = await estadoDe("Riobamba", "Ambato");
        estados.retenidoEnTramoLargo = await estadoDe("Riobamba", "Quito");

        // La tabla exige vence_en = reservada_en + 5 minutos exactos: se calcula una vez.
        await tx.$queryRaw`
          UPDATE rutaec.compras c
             SET reservada_en = h.inicio, vence_en = h.inicio + interval '5 minutes'
            FROM (SELECT clock_timestamp() - interval '10 minutes' AS inicio) h
           WHERE c.id = ${compra}::uuid`;
        estados.libreAlVencer = await estadoDe("Ambato", "Quito");

        await tx.$queryRaw`
          UPDATE rutaec.compras c
             SET reservada_en = h.inicio, vence_en = h.inicio + interval '5 minutes'
            FROM (SELECT clock_timestamp() AS inicio) h
           WHERE c.id = ${compra}::uuid`;
        await tx.$queryRaw`
          UPDATE rutaec.detalle_compra SET estado = 'CONFIRMADO' WHERE compra_id = ${compra}::uuid`;
        estados.ocupadoAlPagar = await estadoDe("Ambato", "Quito");
        estados.ocupadoEnTramoLargo = await estadoDe("Riobamba", "Quito");
        estados.libreEnOtroTramoPagado = await estadoDe("Riobamba", "Ambato");

        throw new Deshacer();
      });
    } catch (error) {
      if (!(error instanceof Deshacer)) throw error;
    }

    assert.deepEqual(estados, {
      retenidoEnSuTramo: "RETENIDO",
      libreEnOtroTramo: "LIBRE",
      retenidoEnTramoLargo: "RETENIDO",
      libreAlVencer: "LIBRE",
      ocupadoAlPagar: "OCUPADO",
      ocupadoEnTramoLargo: "OCUPADO",
      libreEnOtroTramoPagado: "LIBRE",
    });

    const [{ n }] = await prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM rutaec.pasajeros WHERE numero_documento = 'T-DISP-01'`;
    assert.equal(n, 0, "la prueba no debe dejar datos en la base");
  });

  it("GET /disponibilidad responde 200, 400 y 404 segun el caso", async (t) => {
    if (motivoOmision) return t.skip(motivoOmision);

    const ok = await fetch(`${base}/disponibilidad?viajeId=${viajeId}&origen=Ambato&destino=Quito`);
    assert.equal(ok.status, 200);
    const cuerpo = (await ok.json()) as { data: { asientos: unknown[] }; message: string };
    assert.equal(cuerpo.data.asientos.length, 40);

    const sinDatos = await fetch(`${base}/disponibilidad?origen=Ambato`);
    assert.equal(sinDatos.status, 400);
    assert.equal(((await sinDatos.json()) as { code: string }).code, "PARAMETROS_INVALIDOS");

    const noExiste = await fetch(
      `${base}/disponibilidad?viajeId=00000000-0000-0000-0000-000000000000&origen=Ambato&destino=Quito`
    );
    assert.equal(noExiste.status, 404);
    assert.equal(((await noExiste.json()) as { code: string }).code, "NO_ENCONTRADO");
  });

  it("incluye el recorrido completo del viaje con la ciudad de cada parada", async (t) => {
    if (motivoOmision) return t.skip(motivoOmision);
    const d = await servicios.obtenerDisponibilidad(viajeId, "Ambato", "Quito");
    assert.ok(d);

    // El pasajero solo recorre dos paradas, pero el viaje tiene tres.
    assert.equal(d.viaje.paradas.length, 2);
    assert.deepEqual(
      d.recorrido.map((p) => p.ciudad),
      ["Riobamba", "Ambato", "Quito"]
    );
    assert.deepEqual(d.recorrido.map((p) => p.orden), [1, 2, 3]);
    assert.ok(d.recorrido.every((p) => p.permite_subida && p.permite_bajada));
  });

  it("el resumen cuenta los asientos de cada estado y el endpoint lo devuelve", async (t) => {
    if (motivoOmision) return t.skip(motivoOmision);
    const r = await fetch(`${base}/disponibilidad?viajeId=${viajeId}&origen=Ambato&destino=Quito`);
    const { data } = (await r.json()) as {
      data: { resumen: Record<string, number>; recorrido: unknown[] };
    };
    assert.deepEqual(data.resumen, {
      total: 40,
      libres: 40,
      ocupados: 0,
      retenidos: 0,
      no_vendibles: 0,
    });
    assert.equal(data.recorrido.length, 3);
  });

  it("un asiento de una reserva cancelada vuelve a estar libre", async (t) => {
    if (motivoOmision) return t.skip(motivoOmision);
    const observado: Record<string, unknown> = {};

    try {
      await prisma.$transaction(async (tx) => {
        const [{ uid }] = await tx.$queryRaw<{ uid: string }[]>`
          SELECT id::text AS uid FROM rutaec.usuarios WHERE correo = ${CORREO_DATOS_PRUEBA}`;
        await tx.$queryRaw`SELECT set_config('app.usuario_id', ${uid}, true)`;

        const antes = await servicios.obtenerDisponibilidad(viajeId, "Ambato", "Quito", tx);
        const numero = antes!.asientos.find((a) => a.categoria === "NORMAL")!.numero;

        await tx.$queryRaw`
          INSERT INTO rutaec.pasajeros(comprador_id, nombres, apellidos, fecha_nacimiento,
                                       tipo_documento, numero_documento)
          VALUES (${uid}::uuid, 'Ana', 'Prueba', DATE '1990-01-01', 'CEDULA', 'T-DISP-02')`;

        const [{ compra }] = await tx.$queryRaw<{ compra: string }[]>`
          SELECT rutaec.reservar_compra(${uid}::uuid, ${viajeId}::uuid, (
            SELECT jsonb_build_array(jsonb_build_object(
              'pasajero_id', p.id, 'asiento_id', s.id, 'tarifa_id', tf.id))
            FROM rutaec.pasajeros p, rutaec.asientos_viaje s, rutaec.tarifas_viaje tf
            WHERE p.numero_documento = 'T-DISP-02' AND p.comprador_id = ${uid}::uuid
              AND s.viaje_id = ${viajeId}::uuid AND s.numero = ${numero}
              AND tf.viaje_id = ${viajeId}::uuid AND tf.origen_orden = 2
              AND tf.destino_orden = 3 AND tf.categoria = 'NORMAL'
          ))::text AS compra`;

        const reservada = await servicios.obtenerDisponibilidad(viajeId, "Ambato", "Quito", tx);
        observado.estadoReservado = reservada!.asientos.find((a) => a.numero === numero)!.estado;
        observado.resumenReservado = reservada!.resumen;
        observado.cuposReservado = reservada!.viaje.cupos_disponibles;

        await tx.$queryRaw`SELECT rutaec.cancelar_reserva(${compra}::uuid, 'Prueba automatica')`;

        const cancelada = await servicios.obtenerDisponibilidad(viajeId, "Ambato", "Quito", tx);
        observado.estadoCancelado = cancelada!.asientos.find((a) => a.numero === numero)!.estado;
        observado.resumenCancelado = cancelada!.resumen;

        throw new Deshacer();
      });
    } catch (error) {
      if (!(error instanceof Deshacer)) throw error;
    }

    assert.deepEqual(observado, {
      estadoReservado: "RETENIDO",
      resumenReservado: { total: 40, libres: 39, ocupados: 0, retenidos: 1, no_vendibles: 0 },
      cuposReservado: 39,
      estadoCancelado: "LIBRE",
      resumenCancelado: { total: 40, libres: 40, ocupados: 0, retenidos: 0, no_vendibles: 0 },
    });
  });
});

describe("resumirAsientos", () => {
  it("cuenta cada estado y el total", () => {
    const estados = ["LIBRE", "LIBRE", "OCUPADO", "RETENIDO", "NO_VENDIBLE", "LIBRE"] as const;
    assert.deepEqual(resumirAsientos(estados.map((estado) => ({ estado }))), {
      total: 6,
      libres: 3,
      ocupados: 1,
      retenidos: 1,
      no_vendibles: 1,
    });
  });

  it("devuelve ceros si no hay asientos", () => {
    assert.deepEqual(resumirAsientos([]), {
      total: 0,
      libres: 0,
      ocupados: 0,
      retenidos: 0,
      no_vendibles: 0,
    });
  });
});
