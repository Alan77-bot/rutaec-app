
import { prisma } from "../../lib/prisma.js";
import { ErrorAutenticacion } from "../usuarios/usuarios.service.js";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validarId(id: string) {
  if (!UUID.test(id)) {
    throw new ErrorAutenticacion(
      400,
      "El identificador del usuario no es válido."
    );
  }
}

const camposUsuario = {
  id: true,
  nombres: true,
  apellidos: true,
  correo: true,
  tipo_documento: true,
  pais_documento: true,
  numero_documento: true,
  telefono: true,
  activo: true,
  correo_verificado_en: true,
  creado_en: true,
  actualizado_en: true,
  roles_globales: {
    select: {
      rol: true,
    },
  },
  miembros_cooperativa: {
    select: {
      cooperativa_id: true,
      rol: true,
      activo: true,
      cooperativas: {
        select: {
          nombre_comercial: true,
          activa: true,
        },
      },
    },
  },
} as const;

export async function listarUsuariosAdmin() {
  return prisma.usuarios.findMany({
    select: camposUsuario,
    orderBy: [
      { nombres: "asc" },
      { apellidos: "asc" },
    ],
  });
}

export async function obtenerUsuarioAdmin(id: string) {
  validarId(id);

  const usuario = await prisma.usuarios.findUnique({
    where: { id },
    select: camposUsuario,
  });

  if (!usuario) {
    throw new ErrorAutenticacion(
      404,
      "El usuario no existe."
    );
  }

  return usuario;
}

export async function editarUsuarioAdmin(
  id: string,
  entrada: unknown
) {
  validarId(id);

  if (
    !entrada ||
    typeof entrada !== "object" ||
    Array.isArray(entrada)
  ) {
    throw new ErrorAutenticacion(
      400,
      "Los datos enviados no son válidos."
    );
  }

  const datos = entrada as Record<string, unknown>;

  const permitidos = [
    "nombres",
    "apellidos",
    "telefono",
  ];

  const claves = Object.keys(datos);

  if (
    claves.length === 0 ||
    claves.some((clave) => !permitidos.includes(clave))
  ) {
    throw new ErrorAutenticacion(
      400,
      "Solo puedes editar nombres, apellidos y teléfono."
    );
  }

  const cambios: {
    nombres?: string;
    apellidos?: string;
    telefono?: string;
  } = {};

  for (const campo of claves) {
    const valor = datos[campo];

    if (typeof valor !== "string" || !valor.trim()) {
      throw new ErrorAutenticacion(
        400,
        `El campo ${campo} no es válido.`
      );
    }

    const texto = valor.trim();

    if (
      (campo === "nombres" || campo === "apellidos") &&
      texto.length > 100
    ) {
      throw new ErrorAutenticacion(
        400,
        `${campo} admite hasta 100 caracteres.`
      );
    }

    if (campo === "telefono" && !/^09\d{8}$/.test(texto)) {
      throw new ErrorAutenticacion(
        400,
        "El celular debe comenzar con 09 y tener 10 dígitos."
      );
    }

    if (campo === "nombres") cambios.nombres = texto;
    if (campo === "apellidos") cambios.apellidos = texto;
    if (campo === "telefono") cambios.telefono = texto;
  }

  try {
    return await prisma.usuarios.update({
      where: { id },
      data: cambios,
      select: camposUsuario,
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2025"
    ) {
      throw new ErrorAutenticacion(
        404,
        "El usuario no existe."
      );
    }

    throw error;
  }
}

export async function cambiarEstadoUsuarioAdmin(
  id: string,
  entrada: unknown,
  administradorId: string
) {
  validarId(id);

  if (
    !entrada ||
    typeof entrada !== "object" ||
    Array.isArray(entrada)
  ) {
    throw new ErrorAutenticacion(
      400,
      "Debes indicar el estado del usuario."
    );
  }

  const datos = entrada as Record<string, unknown>;

  if (
    Object.keys(datos).length !== 1 ||
    typeof datos.activo !== "boolean"
  ) {
    throw new ErrorAutenticacion(
      400,
      "Debes enviar activo con valor true o false."
    );
  }

  if (id === administradorId) {
    throw new ErrorAutenticacion(
      403,
      "No puedes modificar el estado de tu propia cuenta."
    );
  }

  return prisma.$transaction(async (tx) => {
    const usuario = await tx.usuarios.findUnique({
      where: { id },
      select: {
        id: true,
        roles_globales: {
          select: { rol: true },
        },
      },
    });

    if (!usuario) {
      throw new ErrorAutenticacion(
        404,
        "El usuario no existe."
      );
    }

    if (
      usuario.roles_globales.some(
        (r) => r.rol === "ADMINISTRADOR"
      )
    ) {
      throw new ErrorAutenticacion(
        403,
        "No puedes cambiar el estado de otra cuenta administradora desde esta sección."
      );
    }

    return tx.usuarios.update({
  where: { id },
  data: {
    activo: datos.activo as boolean,
  },
  select: camposUsuario,
});
  });
}
