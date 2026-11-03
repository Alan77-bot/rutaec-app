
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  registrarGerente,
  actualizarGerente,
  actualizarEstadoGerente,
  asignarGerenteExistente,
} from "./gerentes.service.js";

const USUARIO_ID = "11111111-1111-4111-8111-111111111111";
const COOPERATIVA_ID = "22222222-2222-4222-8222-222222222222";

function datosGerente() {
  return {
    nombres: "Gerente",
    apellidos: "Prueba",
    correo: "gerente.prueba@example.com",
    numero_documento: "0912345678",
    telefono: "0991234567",
    cooperativa_id: COOPERATIVA_ID,
    clave: "ClaveSegura123!",
  };
}

async function debeRechazar(
  operacion: () => Promise<unknown>,
  estado: number
) {
  await assert.rejects(operacion, (error: unknown) => {
    assert.ok(error instanceof Error);

    const errorConEstado = error as Error & {
      estado?: number;
    };

    assert.equal(
      errorConEstado.estado,
      estado,
      `Se esperaba HTTP ${estado}, pero se obtuvo ${errorConEstado.estado}`
    );

    return true;
  });
}

describe("Gerentes - validación de creación", () => {
  it("Rechaza datos nulos", async () => {
    await debeRechazar(() => registrarGerente(null), 400);
  });

  it("Rechaza un arreglo como entrada", async () => {
    await debeRechazar(() => registrarGerente([]), 400);
  });

  it("Rechaza un objeto vacío", async () => {
    await debeRechazar(() => registrarGerente({}), 400);
  });

  it("Rechaza nombres vacíos", async () => {
    await debeRechazar(
      () => registrarGerente({
        ...datosGerente(),
        nombres: "",
      }),
      400
    );
  });

  it("Rechaza apellidos vacíos", async () => {
    await debeRechazar(
      () => registrarGerente({
        ...datosGerente(),
        apellidos: " ",
      }),
      400
    );
  });

  it("Rechaza nombres demasiado largos", async () => {
    await debeRechazar(
      () => registrarGerente({
        ...datosGerente(),
        nombres: "A".repeat(101),
      }),
      400
    );
  });

  it("Rechaza correo inválido", async () => {
    await debeRechazar(
      () => registrarGerente({
        ...datosGerente(),
        correo: "correo-invalido",
      }),
      400
    );
  });

  it("Rechaza correo vacío", async () => {
    await debeRechazar(
      () => registrarGerente({
        ...datosGerente(),
        correo: "",
      }),
      400
    );
  });

  it("Rechaza cédula con menos de 10 dígitos", async () => {
    await debeRechazar(
      () => registrarGerente({
        ...datosGerente(),
        numero_documento: "123456789",
      }),
      400
    );
  });

  it("Rechaza cédula con letras", async () => {
    await debeRechazar(
      () => registrarGerente({
        ...datosGerente(),
        numero_documento: "091234567A",
      }),
      400
    );
  });

  it("Rechaza teléfono que no empieza con 09", async () => {
    await debeRechazar(
      () => registrarGerente({
        ...datosGerente(),
        telefono: "0812345678",
      }),
      400
    );
  });

  it("Rechaza teléfono incompleto", async () => {
    await debeRechazar(
      () => registrarGerente({
        ...datosGerente(),
        telefono: "099123456",
      }),
      400
    );
  });

  it("Rechaza identificador de cooperativa inválido", async () => {
    await debeRechazar(
      () => registrarGerente({
        ...datosGerente(),
        cooperativa_id: "invalido",
      }),
      400
    );
  });

  it("Rechaza contraseña corta", async () => {
    await debeRechazar(
      () => registrarGerente({
        ...datosGerente(),
        clave: "123456",
      }),
      400
    );
  });

  it("Rechaza contraseña vacía", async () => {
    await debeRechazar(
      () => registrarGerente({
        ...datosGerente(),
        clave: "",
      }),
      400
    );
  });

  it("Rechaza contraseña que supera 72 bytes", async () => {
    await debeRechazar(
      () => registrarGerente({
        ...datosGerente(),
        clave: "A".repeat(73),
      }),
      400
    );
  });

  it("Rechaza contraseña de tipo numérico", async () => {
    await debeRechazar(
      () => registrarGerente({
        ...datosGerente(),
        clave: 123456789012,
      }),
      400
    );
  });
});

describe("Gerentes - validación de edición", () => {
  it("Rechaza ID de gerente inválido", async () => {
    await debeRechazar(
      () => actualizarGerente("invalido", {
        cooperativa_id: COOPERATIVA_ID,
      }),
      400
    );
  });

  it("Rechaza datos nulos", async () => {
    await debeRechazar(
      () => actualizarGerente(USUARIO_ID, null),
      400
    );
  });

  it("Rechaza un objeto vacío", async () => {
    await debeRechazar(
      () => actualizarGerente(USUARIO_ID, {}),
      400
    );
  });

  it("Rechaza cooperativa inválida", async () => {
    await debeRechazar(
      () => actualizarGerente(USUARIO_ID, {
        cooperativa_id: "invalida",
      }),
      400
    );
  });

  it("Rechaza campos adicionales", async () => {
    await debeRechazar(
      () => actualizarGerente(USUARIO_ID, {
        cooperativa_id: COOPERATIVA_ID,
        rol: "ADMINISTRADOR",
      }),
      400
    );
  });

  it("Rechaza cambiar el usuario mediante PATCH", async () => {
    await debeRechazar(
      () => actualizarGerente(USUARIO_ID, {
        cooperativa_id: COOPERATIVA_ID,
        usuario_id: "33333333-3333-4333-8333-333333333333",
      }),
      400
    );
  });
});

describe("Gerentes - validación de estado", () => {
  it("Rechaza ID inválido", async () => {
    await debeRechazar(
      () => actualizarEstadoGerente("invalido", {
        activo: true,
      }),
      400
    );
  });

  it("Rechaza datos nulos", async () => {
    await debeRechazar(
      () => actualizarEstadoGerente(USUARIO_ID, null),
      400
    );
  });

  it("Rechaza estado ausente", async () => {
    await debeRechazar(
      () => actualizarEstadoGerente(USUARIO_ID, {}),
      400
    );
  });

  it("Rechaza estado como texto", async () => {
    await debeRechazar(
      () => actualizarEstadoGerente(USUARIO_ID, {
        activo: "true",
      }),
      400
    );
  });

  it("Rechaza estado numérico", async () => {
    await debeRechazar(
      () => actualizarEstadoGerente(USUARIO_ID, {
        activo: 1,
      }),
      400
    );
  });

  it("Rechaza campos adicionales", async () => {
    await debeRechazar(
      () => actualizarEstadoGerente(USUARIO_ID, {
        activo: true,
        rol: "ADMINISTRADOR",
      }),
      400
    );
  });
});

describe("Gerentes - asignación de usuario existente", () => {
  it("Rechaza datos nulos", async () => {
    await debeRechazar(
      () => asignarGerenteExistente(null),
      400
    );
  });

  it("Rechaza un arreglo", async () => {
    await debeRechazar(
      () => asignarGerenteExistente([]),
      400
    );
  });

  it("Rechaza un objeto vacío", async () => {
    await debeRechazar(
      () => asignarGerenteExistente({}),
      400
    );
  });

  it("Rechaza usuario_id inválido", async () => {
    await debeRechazar(
      () => asignarGerenteExistente({
        usuario_id: "invalido",
        cooperativa_id: COOPERATIVA_ID,
      }),
      400
    );
  });

  it("Rechaza cooperativa_id inválido", async () => {
    await debeRechazar(
      () => asignarGerenteExistente({
        usuario_id: USUARIO_ID,
        cooperativa_id: "invalido",
      }),
      400
    );
  });

  it("Rechaza usuario_id ausente", async () => {
    await debeRechazar(
      () => asignarGerenteExistente({
        cooperativa_id: COOPERATIVA_ID,
      }),
      400
    );
  });

  it("Rechaza cooperativa_id ausente", async () => {
    await debeRechazar(
      () => asignarGerenteExistente({
        usuario_id: USUARIO_ID,
      }),
      400
    );
  });

  it("Rechaza campos adicionales", async () => {
    await debeRechazar(
      () => asignarGerenteExistente({
        usuario_id: USUARIO_ID,
        cooperativa_id: COOPERATIVA_ID,
        activo: true,
      }),
      400
    );
  });

  it("Rechaza intentar asignar un rol arbitrario", async () => {
    await debeRechazar(
      () => asignarGerenteExistente({
        usuario_id: USUARIO_ID,
        cooperativa_id: COOPERATIVA_ID,
        rol: "ADMINISTRADOR",
      }),
      400
    );
  });
});
