import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma.js";

export const DURACION_SESION_MS = 8 * 60 * 60 * 1000;

export class ErrorAutenticacion extends Error {
  constructor(
    public estado: number,
    mensaje: string
  ) {
    super(mensaje);
  }
}

const relaciones = {
  roles_globales: true,
  miembros_cooperativa: {
    where: {
      activo: true,
      cooperativas: {
        activa: true,
      },
    },
    orderBy: {
      cooperativa_id: "asc" as const,
    },
  },
} as const;

function buscarUsuarioPorId(id: string) {
  return prisma.usuarios.findUnique({
    where: { id },
    include: relaciones,
  });
}

type UsuarioLogin = NonNullable<
  Awaited<ReturnType<typeof buscarUsuarioPorId>>
>;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function tokenValido(token: unknown): token is string {
  return typeof token === "string" && /^[a-f0-9]{64}$/.test(token);
}

function datosSesion(usuario: UsuarioLogin) {
  const roles = usuario.roles_globales.map((asignacion) => asignacion.rol);
  const miembros = usuario.miembros_cooperativa;

  let rol: "admin" | "cooperativa" | "oficinista" | "usuario";
  let coopId: string | null = null;

  if (roles.includes("ADMINISTRADOR")) {
    rol = "admin";
  } else if (miembros.length > 1) {
    throw new ErrorAutenticacion(
      409,
      "Esta cuenta pertenece a varias cooperativas. Se requiere implementar la selección de cooperativa."
    );
  } else if (miembros.length === 1) {
    const miembro = miembros[0];

    if (miembro.rol === "GERENTE") {
      rol = "cooperativa";
    } else if (miembro.rol === "OFICINISTA") {
      rol = "oficinista";
    } else {
      throw new ErrorAutenticacion(403, "La cuenta no tiene un rol habilitado.");
    }

    coopId = miembro.cooperativa_id;
  } else if (roles.includes("CLIENTE")) {
    rol = "usuario";
  } else {
    throw new ErrorAutenticacion(403, "La cuenta no tiene un rol habilitado.");
  }

  return {
    id: usuario.id,
    nombre: `${usuario.nombres} ${usuario.apellidos}`.trim(),
    correo: usuario.correo,
    rol,
    coopId,
  };
}

function verificarCuenta(usuario: UsuarioLogin) {
  if (!usuario.activo) {
    throw new ErrorAutenticacion(403, "Tu cuenta está desactivada.");
  }

  if (!usuario.correo_verificado_en) {
    throw new ErrorAutenticacion(
      403,
      "Debes verificar tu correo antes de ingresar."
    );
  }
}

// Evita omitir el cálculo del hash cuando el correo no existe.
const hashComparacion = bcrypt.hash(randomBytes(32).toString("hex"), 12);

export async function autenticar(correo: unknown, clave: unknown) {
  if (
    typeof correo !== "string" ||
    typeof clave !== "string" ||
    correo.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim()) ||
    clave.length === 0 ||
    Buffer.byteLength(clave, "utf8") > 72
  ) {
    throw new ErrorAutenticacion(
      400,
      "Escribe un correo válido y una contraseña de hasta 72 bytes."
    );
  }

  const usuario = await prisma.usuarios.findFirst({
    where: {
      correo: {
        equals: correo.trim().toLowerCase(),
        mode: "insensitive",
      },
    },
    include: relaciones,
  });

  const coincide = await bcrypt.compare(
    clave,
    usuario?.password_hash ?? (await hashComparacion)
  );

  if (!usuario || !coincide) {
    throw new ErrorAutenticacion(401, "Correo o contraseña incorrectos.");
  }

  verificarCuenta(usuario);

  const sesion = datosSesion(usuario);
  const token = randomBytes(32).toString("hex");
  const venceEn = new Date(Date.now() + DURACION_SESION_MS);

  await prisma.$transaction(async (tx) => {
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
      select: {
        password_hash: true,
        activo: true,
        correo_verificado_en: true,
      },
    });

    if (
      !actual ||
      !actual.activo ||
      !actual.correo_verificado_en ||
      actual.password_hash !== usuario.password_hash
    ) {
      throw new ErrorAutenticacion(
        401,
        "La cuenta cambió durante el acceso. Inicia sesión nuevamente."
      );
    }

    await tx.tokens_acceso.create({
      data: {
        usuario_id: usuario.id,
        proposito: "REFRESH",
        token_hash: hashToken(token),
        vence_en: venceEn,
      },
    });
  });

  return { token, sesion };
}

export async function obtenerSesion(token: unknown) {
  if (!tokenValido(token)) {
    throw new ErrorAutenticacion(401, "Debes iniciar sesión.");
  }

  const registro = await prisma.tokens_acceso.findUnique({
    where: {
      token_hash: hashToken(token),
    },
  });

  if (
    !registro ||
    registro.proposito !== "REFRESH" ||
    registro.revocado_en ||
    registro.consumido_en ||
    registro.vence_en.getTime() <= Date.now()
  ) {
    throw new ErrorAutenticacion(401, "Tu sesión terminó. Ingresa nuevamente.");
  }

  const usuario = await buscarUsuarioPorId(registro.usuario_id);

  if (!usuario || !usuario.activo || !usuario.correo_verificado_en) {
    throw new ErrorAutenticacion(401, "La sesión ya no está habilitada.");
  }

  return datosSesion(usuario);
}

export async function revocarSesion(token: unknown) {
  if (!tokenValido(token)) return;

  await prisma.tokens_acceso.updateMany({
    where: {
      token_hash: hashToken(token),
      proposito: "REFRESH",
      revocado_en: null,
    },
    data: {
      revocado_en: new Date(),
    },
  });
}