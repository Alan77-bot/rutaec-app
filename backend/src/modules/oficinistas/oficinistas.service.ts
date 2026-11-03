
import { prisma } from "../../lib/prisma.js";
import { ErrorAutenticacion } from "../usuarios/usuarios.service.js";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validarUuid(valor: unknown, campo: string): string {
  if (typeof valor !== "string" || !UUID.test(valor)) {
    throw new ErrorAutenticacion(400, `${campo} no es válido.`);
  }

  return valor;
}

export async function comprobarGerente(
  usuarioId: string,
  cooperativaId: string
) {
  const gerente = await prisma.miembros_cooperativa.findUnique({
    where: {
      cooperativa_id_usuario_id: {
        cooperativa_id: cooperativaId,
        usuario_id: usuarioId,
      },
    },
    select: {
      rol: true,
      activo: true,
      cooperativas: {
        select: {
          activa: true,
        },
      },
    },
  });

  if (
    !gerente ||
    gerente.rol !== "GERENTE" ||
    !gerente.activo ||
    !gerente.cooperativas.activa
  ) {
    throw new ErrorAutenticacion(
      403,
      "No tienes permisos para gestionar esta cooperativa."
    );
  }
}

export async function obtenerOficinistas(cooperativaId: string) {
  return prisma.miembros_cooperativa.findMany({
    where: {
      cooperativa_id: cooperativaId,
      rol: "OFICINISTA",
    },
    select: {
      usuario_id: true,
      cooperativa_id: true,
      activo: true,
      asignado_en: true,
      usuarios: {
        select: {
          id: true,
          nombres: true,
          apellidos: true,
          correo: true,
          telefono: true,
          activo: true,
          correo_verificado_en: true,
        },
      },
    },
    orderBy: {
      asignado_en: "desc",
    },
  });
}

export async function asignarOficinista(
  cooperativaId: string,
  entrada: unknown
) {
  const datos =
    entrada &&
    typeof entrada === "object" &&
    !Array.isArray(entrada)
      ? (entrada as Record<string, unknown>)
      : {};

  if (Object.keys(datos).length !== 1) {
    throw new ErrorAutenticacion(
      400,
      "Debes enviar únicamente usuario_id."
    );
  }

  const usuarioId = validarUuid(
    datos.usuario_id,
    "El usuario"
  );

  return prisma.$transaction(async (tx) => {
    const usuario = await tx.usuarios.findUnique({
      where: {
        id: usuarioId,
      },
      select: {
        activo: true,
        correo_verificado_en: true,
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
          },
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
      !usuario.activo ||
      !usuario.correo_verificado_en
    ) {
      throw new ErrorAutenticacion(
        409,
        "El usuario debe tener su cuenta activa y correo verificado."
      );
    }

    if (
      usuario.roles_globales.some(
        (rol) => rol.rol === "ADMINISTRADOR"
      )
    ) {
      throw new ErrorAutenticacion(
        409,
        "No puedes asignar a un administrador como oficinista."
      );
    }

    if (
      usuario.miembros_cooperativa.some(
        (miembro) => miembro.activo
      )
    ) {
      throw new ErrorAutenticacion(
        409,
        "El usuario ya tiene una asignación activa."
      );
    }

    const asignacionAnterior =
      usuario.miembros_cooperativa.find(
        (miembro) =>
          miembro.cooperativa_id === cooperativaId
      );

    if (
      asignacionAnterior &&
      asignacionAnterior.rol !== "OFICINISTA"
    ) {
      throw new ErrorAutenticacion(
        409,
        "El usuario tiene otro rol registrado en esta cooperativa."
      );
    }

    const asignacion =
      await tx.miembros_cooperativa.upsert({
        where: {
          cooperativa_id_usuario_id: {
            cooperativa_id: cooperativaId,
            usuario_id: usuarioId,
          },
        },
        create: {
          cooperativa_id: cooperativaId,
          usuario_id: usuarioId,
          rol: "OFICINISTA",
          activo: true,
        },
        update: {
          activo: true,
        },
      });

    // Evita conservar el rol CLIENTE al convertirse en oficinista.
    await tx.roles_globales.deleteMany({
      where: {
        usuario_id: usuarioId,
        rol: "CLIENTE",
      },
    });

    return asignacion;
  });
}

export async function cambiarEstadoOficinista(
  cooperativaId: string,
  usuarioId: string,
  entrada: unknown
) {
  validarUuid(usuarioId, "El usuario");

  const datos =
    entrada &&
    typeof entrada === "object" &&
    !Array.isArray(entrada)
      ? (entrada as Record<string, unknown>)
      : {};

  if (
    Object.keys(datos).length !== 1 ||
    typeof datos.activo !== "boolean"
  ) {
    throw new ErrorAutenticacion(
      400,
      "Debes enviar activo como booleano."
    );
  }

  const activar = datos.activo as boolean;

  return prisma.$transaction(async (tx) => {
    const asignacion =
      await tx.miembros_cooperativa.findUnique({
        where: {
          cooperativa_id_usuario_id: {
            cooperativa_id: cooperativaId,
            usuario_id: usuarioId,
          },
        },
      });

    if (
      !asignacion ||
      asignacion.rol !== "OFICINISTA"
    ) {
      throw new ErrorAutenticacion(
        404,
        "El oficinista no pertenece a esta cooperativa."
      );
    }

    if (activar) {
      const usuario = await tx.usuarios.findUnique({
        where: {
          id: usuarioId,
        },
        select: {
          activo: true,
          correo_verificado_en: true,
          roles_globales: {
            select: {
              rol: true,
            },
          },
          miembros_cooperativa: {
            where: {
              activo: true,
              cooperativa_id: {
                not: cooperativaId,
              },
            },
            select: {
              cooperativa_id: true,
            },
          },
        },
      });

      if (
        !usuario?.activo ||
        !usuario.correo_verificado_en ||
        usuario.roles_globales.some(
          (rol) => rol.rol === "ADMINISTRADOR"
        ) ||
        usuario.miembros_cooperativa.length > 0
      ) {
        throw new ErrorAutenticacion(
          409,
          "El usuario no cumple las condiciones para activar su asignación."
        );
      }
    }

    const resultado =
      await tx.miembros_cooperativa.update({
        where: {
          cooperativa_id_usuario_id: {
            cooperativa_id: cooperativaId,
            usuario_id: usuarioId,
          },
        },
        data: {
          activo: activar,
        },
      });

    if (activar) {
      await tx.roles_globales.deleteMany({
        where: {
          usuario_id: usuarioId,
          rol: "CLIENTE",
        },
      });
    }

    return resultado;
  });
}
