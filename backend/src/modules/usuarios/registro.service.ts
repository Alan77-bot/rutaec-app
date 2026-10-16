import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma.js";
import { enviarCodigoVerificacion } from "./correo.service.js";
import { ErrorAutenticacion } from "./usuarios.service.js";

const DURACION_CODIGO_MS = 10 * 60 * 1000;

function leerTexto(
  datos: Record<string, unknown>,
  campo: string,
  maximo: number
): string {
  const valor = datos[campo];

  if (
    typeof valor !== "string" ||
    !valor.trim() ||
    valor.trim().length > maximo
  ) {
    throw new ErrorAutenticacion(
      400,
      `El campo ${campo} es obligatorio y admite hasta ${maximo} caracteres.`
    );
  }

  return valor.trim();
}

export async function registrarUsuario(entrada: unknown) {
  if (
    !entrada ||
    typeof entrada !== "object" ||
    Array.isArray(entrada)
  ) {
    throw new ErrorAutenticacion(400, "Los datos del registro no son válidos.");
  }

  const datos = entrada as Record<string, unknown>;

  const nombres = leerTexto(datos, "nombres", 100);
  const apellidos = leerTexto(datos, "apellidos", 100);
  const correo = leerTexto(datos, "correo", 254).toLowerCase();
  const documento = leerTexto(datos, "numero_documento", 10);
  const telefono = leerTexto(datos, "telefono", 10);
  const clave = datos.clave;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    throw new ErrorAutenticacion(400, "El correo no tiene un formato válido.");
  }

  if (!/^\d{10}$/.test(documento)) {
    throw new ErrorAutenticacion(400, "La cédula debe tener 10 dígitos.");
  }

  if (!/^09\d{8}$/.test(telefono)) {
    throw new ErrorAutenticacion(
      400,
      "El celular debe tener 10 dígitos y comenzar con 09."
    );
  }

  if (
    typeof clave !== "string" ||
    clave.length < 12 ||
    Buffer.byteLength(clave, "utf8") > 72
  ) {
    throw new ErrorAutenticacion(
      400,
      "La contraseña debe tener al menos 12 caracteres y hasta 72 bytes."
    );
  }

  const existente = await prisma.usuarios.findFirst({
    where: {
      OR: [
        {
          correo: {
            equals: correo,
            mode: "insensitive",
          },
        },
        {
          pais_documento: "EC",
          tipo_documento: "CEDULA",
          numero_documento: documento,
        },
      ],
    },
    select: {
      id: true,
    },
  });

  if (existente) {
    throw new ErrorAutenticacion(
      409,
      "No se puede crear otra cuenta con esos datos. Si ya te registraste, verifica tu correo o inicia sesión."
    );
  }

  const codigo = randomInt(0, 1000000).toString().padStart(6, "0");

  const [passwordHash, codigoHash] = await Promise.all([
    bcrypt.hash(clave, 12),
    bcrypt.hash(codigo, 12),
  ]);

  const venceEn = new Date(Date.now() + DURACION_CODIGO_MS);

  const registro = await prisma
    .$transaction(async (tx) => {
      const usuario = await tx.usuarios.create({
        data: {
          nombres,
          apellidos,
          correo,
          tipo_documento: "CEDULA",
          pais_documento: "EC",
          numero_documento: documento,
          telefono,
          password_hash: passwordHash,
          activo: true,
          correo_verificado_en: null,
          roles_globales: {
            create: {
              rol: "CLIENTE",
            },
          },
        },
        select: {
          id: true,
        },
      });

      const verificacion = await tx.tokens_acceso.create({
        data: {
          usuario_id: usuario.id,
          proposito: "VERIFICAR_CORREO",
          token_hash: codigoHash,
          vence_en: venceEn,
        },
        select: {
          id: true,
        },
      });

      return {
        verificacionId: verificacion.id,
      };
    })
    .catch((error: unknown) => {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        throw new ErrorAutenticacion(
          409,
          "Ya existe una cuenta con ese correo o documento."
        );
      }

      throw error;
    });

  try {
    await enviarCodigoVerificacion(correo, codigo, venceEn);
  } catch {
    await prisma.tokens_acceso.updateMany({
      where: {
        id: registro.verificacionId,
        proposito: "VERIFICAR_CORREO",
        consumido_en: null,
        revocado_en: null,
      },
      data: {
        revocado_en: new Date(),
      },
    });

    throw new ErrorAutenticacion(
      503,
      "La cuenta quedó pendiente de verificación, pero no pudimos enviar el correo. Solicita un nuevo código cuando el servicio esté disponible."
    );
  }

  return {
    mensaje: "Cuenta creada. Revisa tu correo para verificarla.",
    correo,
    verificacionId: registro.verificacionId,
    venceEn: venceEn.toISOString(),
  };
}