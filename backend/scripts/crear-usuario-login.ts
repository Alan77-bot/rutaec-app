import "dotenv/config";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma.js";

async function main() {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("Este script solo se permite en development.");
  }

  const correo = (
    process.env.LOGIN_TEST_EMAIL ?? "login.prueba@example.com"
  ).trim().toLowerCase();

  const clave = process.env.LOGIN_TEST_PASSWORD;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    throw new Error("El correo de prueba no es válido.");
  }

  if (
    !clave ||
    clave.length < 12 ||
    Buffer.byteLength(clave, "utf8") > 72
  ) {
    throw new Error("Usa una contraseña de 12 caracteres o más, hasta 72 bytes.");
  }

  const existente = await prisma.usuarios.findFirst({
    where: {
      correo: {
        equals: correo,
        mode: "insensitive",
      },
    },
  });

  if (existente) {
    throw new Error(
      "El correo ya existe. No se modificó su contraseña ni sus permisos."
    );
  }

  const passwordHash = await bcrypt.hash(clave, 12);

  const usuario = await prisma.$transaction(async (tx) => {
    await tx.roles.upsert({
      where: { codigo: "CLIENTE" },
      update: {},
      create: {
        codigo: "CLIENTE",
        nombre: "Cliente",
      },
    });

    return tx.usuarios.create({
      data: {
        correo,
        nombres: "Usuario",
        apellidos: "Prueba Login",
        tipo_documento: "OTRO",
        pais_documento: "EC",
        numero_documento: `TEST-${randomUUID()}`,
        telefono: "0000000000",
        password_hash: passwordHash,
        activo: true,
        correo_verificado_en: new Date(),
        roles_globales: {
          create: {
            rol: "CLIENTE",
          },
        },
      },
      select: {
        id: true,
        correo: true,
        activo: true,
      },
    });
  });

  console.log("Usuario de desarrollo creado:");
  console.table(usuario);
}

main()
  .catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "No se pudo crear el usuario."
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });