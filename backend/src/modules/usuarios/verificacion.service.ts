import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma.js";
import { enviarCodigoVerificacion } from "./correo.service.js";
import { ErrorAutenticacion } from "./usuarios.service.js";

const DURACION_CODIGO_MS = 10 * 60 * 1000;
const ESPERA_REENVIO_MS = 60 * 1000;

function leerDatos(entrada: unknown): Record<string, unknown> {
  if (
    !entrada ||
    typeof entrada !== "object" ||
    Array.isArray(entrada)
  ) {
    throw new ErrorAutenticacion(400, "Los datos no son válidos.");
  }

  return entrada as Record<string, unknown>;
}

function leerClave(datos: Record<string, unknown>): string {
  const clave = datos.clave;

  if (
    typeof clave !== "string" ||
    !clave ||
    Buffer.byteLength(clave, "utf8") > 72
  ) {
    throw new ErrorAutenticacion(400, "Introduce la contraseña del registro.");
  }

  return clave;
}

export async function verificarCorreo(entrada: unknown) {
  const datos = leerDatos(entrada);
  const clave = leerClave(datos);
  const verificacionId = datos.verificacionId;
  const codigo = datos.codigo;

  if (
    typeof verificacionId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      verificacionId
    ) ||
    typeof codigo !== "string" ||
    !/^\d{6}$/.test(codigo)
  ) {
    throw new ErrorAutenticacion(
      400,
      "Introduce el código de seis dígitos."
    );
  }

  const token = await prisma.tokens_acceso.findUnique({
    where: {
      id: verificacionId,
    },
    include: {
      usuarios: true,
    },
  });

  if (
    !token ||
    token.proposito !== "VERIFICAR_CORREO" ||
    token.consumido_en ||
    token.revocado_en ||
    token.vence_en.getTime() <= Date.now() ||
    !token.usuarios.activo ||
    token.usuarios.correo_verificado_en
  ) {
    throw new ErrorAutenticacion(
      400,
      "La verificación no está disponible. Solicita un nuevo código o inicia sesión."
    );
  }

  const [codigoCorrecto, claveCorrecta] = await Promise.all([
    bcrypt.compare(codigo, token.token_hash),
    bcrypt.compare(clave, token.usuarios.password_hash),
  ]);

  if (!codigoCorrecto || !claveCorrecta) {
    throw new ErrorAutenticacion(
      400,
      "El código o la contraseña no son correctos."
    );
  }

  await prisma.$transaction(async (tx) => {
    // Serializa la confirmación y los reenvíos de esta cuenta.
    await tx.$queryRaw`
      SELECT id
      FROM rutaec.usuarios
      WHERE id = ${token.usuario_id}::uuid
      FOR UPDATE
    `;

    const ahora = new Date();

    const consumido = await tx.tokens_acceso.updateMany({
      where: {
        id: token.id,
        proposito: "VERIFICAR_CORREO",
        consumido_en: null,
        revocado_en: null,
        vence_en: {
          gt: ahora,
        },
      },
      data: {
        consumido_en: ahora,
      },
    });

    if (consumido.count !== 1) {
      throw new ErrorAutenticacion(
        400,
        "El código venció o ya fue utilizado. Solicita uno nuevo."
      );
    }

    const actualizado = await tx.usuarios.updateMany({
      where: {
        id: token.usuario_id,
        activo: true,
        correo_verificado_en: null,
        password_hash: token.usuarios.password_hash,
      },
      data: {
        correo_verificado_en: ahora,
      },
    });

    if (actualizado.count !== 1) {
      throw new ErrorAutenticacion(
        409,
        "El estado de la cuenta cambió. Vuelve a iniciar el proceso."
      );
    }

    await tx.tokens_acceso.updateMany({
      where: {
        usuario_id: token.usuario_id,
        proposito: "VERIFICAR_CORREO",
        consumido_en: null,
        revocado_en: null,
      },
      data: {
        revocado_en: ahora,
      },
    });
  });

  return {
    mensaje: "Correo verificado. Ya puedes iniciar sesión.",
  };
}

export async function reenviarCodigo(entrada: unknown) {
  const datos = leerDatos(entrada);
  const clave = leerClave(datos);
  const correoEntrada = datos.correo;

  if (
    typeof correoEntrada !== "string" ||
    correoEntrada.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoEntrada.trim())
  ) {
    throw new ErrorAutenticacion(400, "Introduce un correo válido.");
  }

  const correo = correoEntrada.trim().toLowerCase();

  const usuario = await prisma.usuarios.findFirst({
    where: {
      correo: {
        equals: correo,
        mode: "insensitive",
      },
    },
  });

  if (!usuario) {
    throw new ErrorAutenticacion(
      400,
      "No se pudo solicitar un código con esos datos."
    );
  }

  const claveCorrecta = await bcrypt.compare(clave, usuario.password_hash);

  if (!claveCorrecta || !usuario.activo) {
    throw new ErrorAutenticacion(
      400,
      "No se pudo solicitar un código con esos datos."
    );
  }

  if (usuario.correo_verificado_en) {
    throw new ErrorAutenticacion(
      409,
      "El correo ya está verificado. Inicia sesión."
    );
  }

  const codigo = randomInt(0, 1000000).toString().padStart(6, "0");
  const codigoHash = await bcrypt.hash(codigo, 12);

  const verificacion = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT id
      FROM rutaec.usuarios
      WHERE id = ${usuario.id}::uuid
      FOR UPDATE
    `;

    const actual = await tx.usuarios.findUnique({
      where: {
        id: usuario.id,
      },
    });

    if (
      !actual ||
      !actual.activo ||
      actual.correo_verificado_en ||
      actual.password_hash !== usuario.password_hash ||
      actual.correo !== usuario.correo
    ) {
      throw new ErrorAutenticacion(
        409,
        "El estado de la cuenta cambió. Vuelve a iniciar el proceso."
      );
    }

    const ahora = new Date();

    const ultimo = await tx.tokens_acceso.findFirst({
      where: {
        usuario_id: usuario.id,
        proposito: "VERIFICAR_CORREO",
      },
      orderBy: {
        creado_en: "desc",
      },
    });

    if (
      ultimo &&
      ahora.getTime() - ultimo.creado_en.getTime() < ESPERA_REENVIO_MS
    ) {
      throw new ErrorAutenticacion(
        429,
        "Espera un minuto desde el último envío antes de solicitar otro código."
      );
    }

    const solicitudesRecientes = await tx.tokens_acceso.count({
      where: {
        usuario_id: usuario.id,
        proposito: "VERIFICAR_CORREO",
        creado_en: {
          gte: new Date(ahora.getTime() - 60 * 60 * 1000),
        },
      },
    });

    if (solicitudesRecientes >= 5) {
      throw new ErrorAutenticacion(
        429,
        "Alcanzaste el límite de códigos por hora. Inténtalo más tarde."
      );
    }

    await tx.tokens_acceso.updateMany({
      where: {
        usuario_id: usuario.id,
        proposito: "VERIFICAR_CORREO",
        consumido_en: null,
        revocado_en: null,
      },
      data: {
        revocado_en: ahora,
      },
    });

    return tx.tokens_acceso.create({
      data: {
        usuario_id: usuario.id,
        proposito: "VERIFICAR_CORREO",
        token_hash: codigoHash,
        vence_en: new Date(ahora.getTime() + DURACION_CODIGO_MS),
      },
      select: {
        id: true,
        vence_en: true,
      },
    });
  });

  try {
    await enviarCodigoVerificacion(
      usuario.correo,
      codigo,
      verificacion.vence_en
    );
  } catch {
    await prisma.tokens_acceso.updateMany({
      where: {
        id: verificacion.id,
        consumido_en: null,
        revocado_en: null,
      },
      data: {
        revocado_en: new Date(),
      },
    });

    throw new ErrorAutenticacion(
      503,
      "No pudimos enviar el código. Espera un minuto e inténtalo nuevamente."
    );
  }

  return {
    mensaje: "Enviamos un nuevo código a tu correo.",
    correo: usuario.correo,
    verificacionId: verificacion.id,
    venceEn: verificacion.vence_en.toISOString(),
  };
}