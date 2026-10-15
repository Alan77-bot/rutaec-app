import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma.js";
import { enviarEnlaceRecuperacion } from "./recuperacion.correo.service.js";
import { ErrorAutenticacion } from "./usuarios.service.js";

const DURACION_TOKEN_MS = 15 * 60 * 1000;
const ESPERA_SOLICITUD_MS = 60 * 1000;

const MENSAJE_SOLICITUD =
  "Si el correo corresponde a una cuenta habilitada y puede recibir otra solicitud, enviaremos un enlace de recuperación. Revisa también spam.";

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

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function enlaceInvalido(): ErrorAutenticacion {
  return new ErrorAutenticacion(
    400,
    "El enlace no es válido, venció o ya fue utilizado. Solicita uno nuevo."
  );
}

export async function solicitarRecuperacion(entrada: unknown) {
  const datos = leerDatos(entrada);
  const correoEntrada = datos.correo;

  if (
    typeof correoEntrada !== "string" ||
    correoEntrada.trim().length > 254 ||
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
    select: {
      id: true,
    },
  });

  if (!usuario) {
    return { mensaje: MENSAJE_SOLICITUD };
  }

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);

  const registro = await prisma.$transaction(async (tx) => {
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
      !actual.correo_verificado_en ||
      actual.correo.toLowerCase() !== correo
    ) {
      return null;
    }

    const ahora = new Date();

    const ultimo = await tx.tokens_acceso.findFirst({
      where: {
        usuario_id: usuario.id,
        proposito: "RECUPERAR_CLAVE",
      },
      orderBy: {
        creado_en: "desc",
      },
    });

    if (
      ultimo &&
      ahora.getTime() - ultimo.creado_en.getTime() < ESPERA_SOLICITUD_MS
    ) {
      return null;
    }

    const solicitudesRecientes = await tx.tokens_acceso.count({
      where: {
        usuario_id: usuario.id,
        proposito: "RECUPERAR_CLAVE",
        creado_en: {
          gte: new Date(ahora.getTime() - 60 * 60 * 1000),
        },
      },
    });

    if (solicitudesRecientes >= 5) {
      return null;
    }

    const verificacion = await tx.tokens_acceso.create({
      data: {
        usuario_id: usuario.id,
        proposito: "RECUPERAR_CLAVE",
        token_hash: tokenHash,
        vence_en: new Date(ahora.getTime() + DURACION_TOKEN_MS),
      },
      select: {
        id: true,
        vence_en: true,
      },
    });

    return {
      id: verificacion.id,
      venceEn: verificacion.vence_en,
      correo: actual.correo,
    };
  });

  if (!registro) {
    return { mensaje: MENSAJE_SOLICITUD };
  }

  try {
    await enviarEnlaceRecuperacion(
      registro.correo,
      token,
      registro.venceEn
    );
  } catch {
    await prisma.tokens_acceso.updateMany({
      where: {
        id: registro.id,
        consumido_en: null,
        revocado_en: null,
      },
      data: {
        revocado_en: new Date(),
      },
    });

    console.error("[recuperacion] No se pudo enviar el correo");
  }

  return { mensaje: MENSAJE_SOLICITUD };
}

export async function restablecerContrasena(entrada: unknown) {
  const datos = leerDatos(entrada);

  const token = datos.token;
  const nuevaClave = datos.nuevaClave;
  const confirmarClave = datos.confirmarClave;

  if (
    typeof token !== "string" ||
    !/^[a-f0-9]{64}$/.test(token)
  ) {
    throw enlaceInvalido();
  }

  if (
    typeof nuevaClave !== "string" ||
    nuevaClave.length < 12 ||
    Buffer.byteLength(nuevaClave, "utf8") > 72
  ) {
    throw new ErrorAutenticacion(
      400,
      "La contraseña debe tener al menos 12 caracteres y hasta 72 bytes."
    );
  }

  if (
    typeof confirmarClave !== "string" ||
    nuevaClave !== confirmarClave
  ) {
    throw new ErrorAutenticacion(
      400,
      "Las contraseñas no coinciden."
    );
  }

  const tokenHash = hashToken(token);

  const registro = await prisma.tokens_acceso.findUnique({
    where: {
      token_hash: tokenHash,
    },
  });

  if (
    !registro ||
    registro.proposito !== "RECUPERAR_CLAVE" ||
    registro.consumido_en ||
    registro.revocado_en ||
    registro.vence_en.getTime() <= Date.now()
  ) {
    throw enlaceInvalido();
  }

  const nuevoHash = await bcrypt.hash(nuevaClave, 12);

  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT id
      FROM rutaec.usuarios
      WHERE id = ${registro.usuario_id}::uuid
      FOR UPDATE
    `;

    const usuario = await tx.usuarios.findUnique({
      where: {
        id: registro.usuario_id,
      },
    });

    if (
      !usuario ||
      !usuario.activo ||
      !usuario.correo_verificado_en
    ) {
      throw enlaceInvalido();
    }

    const ahora = new Date();

    const consumido = await tx.tokens_acceso.updateMany({
      where: {
        id: registro.id,
        token_hash: tokenHash,
        proposito: "RECUPERAR_CLAVE",
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
      throw enlaceInvalido();
    }

    await tx.usuarios.update({
      where: {
        id: usuario.id,
      },
      data: {
        password_hash: nuevoHash,
        actualizado_en: ahora,
      },
    });

    // Invalida las sesiones y los demás tokens pendientes de la cuenta.
    await tx.tokens_acceso.updateMany({
      where: {
        usuario_id: usuario.id,
        consumido_en: null,
        revocado_en: null,
      },
      data: {
        revocado_en: ahora,
      },
    });
  });

  return {
    mensaje:
      "Contraseña actualizada. Inicia sesión con tu nueva contraseña.",
  };
}