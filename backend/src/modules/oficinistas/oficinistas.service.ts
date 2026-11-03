
import { prisma } from "../../lib/prisma.js";
import { ErrorAutenticacion } from "../usuarios/usuarios.service.js";
import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { enviarCodigoVerificacion } from "../usuarios/correo.service.js";

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




export async function obtenerUsuariosDisponiblesOficinista(
  cooperativaId: string,
  parametros: {
    buscar?: string;
    pagina?: number;
    limite?: number;
  } = {}
) {
  const buscar = (parametros.buscar ?? "").trim();
  const pagina = parametros.pagina ?? 1;
  const limite = parametros.limite ?? 10;

  if (
    buscar.length > 100 ||
    !Number.isSafeInteger(pagina) ||
    pagina < 1 ||
    !Number.isSafeInteger(limite) ||
    limite < 1 ||
    limite > 50
  ) {
    throw new ErrorAutenticacion(
      400,
      "Los parámetros de búsqueda no son válidos."
    );
  }

  const where = {
    activo: true,
    correo_verificado_en: {
      not: null,
    },
    roles_globales: {
      none: {
        rol: "ADMINISTRADOR",
      },
    },
    miembros_cooperativa: {
      none: {
        activo: true,
      },
    },
    AND: [
      {
        miembros_cooperativa: {
          none: {
            cooperativa_id: cooperativaId,
            rol: {
              not: "OFICINISTA",
            },
          },
        },
      },
      ...(buscar
        ? [
            {
              OR: [
                { nombres: { contains: buscar, mode: "insensitive" as const } },
                { apellidos: { contains: buscar, mode: "insensitive" as const } },
                { correo: { contains: buscar, mode: "insensitive" as const } },
                { numero_documento: { contains: buscar, mode: "insensitive" as const } },
              ],
            },
          ]
        : []),
    ],
  };

  const total = await prisma.usuarios.count({ where });

  const datos = await prisma.usuarios.findMany({
    where,
    select: {
      id: true,
      nombres: true,
      apellidos: true,
      correo: true,
      numero_documento: true,
    },
    orderBy: [
      { nombres: "asc" },
      { apellidos: "asc" },
      { id: "asc" },
    ],
    skip: (pagina - 1) * limite,
    take: limite,
  });

  return {
    datos,
    paginacion: {
      pagina,
      limite,
      total,
      totalPaginas: Math.ceil(total / limite),
    },
  };
}



export async function registrarNuevoOficinista(
  cooperativaId: string,
  entrada: unknown
) {
  if (
    !entrada ||
    typeof entrada !== "object" ||
    Array.isArray(entrada)
  ) {
    throw new ErrorAutenticacion(
      400,
      "Los datos del oficinista no son válidos."
    );
  }

  const datos = entrada as Record<string, unknown>;

  const campos = [
    "nombres",
    "apellidos",
    "correo",
    "numero_documento",
    "telefono",
    "clave",
  ];

  if (
    Object.keys(datos).length !== campos.length ||
    Object.keys(datos).some((campo) => !campos.includes(campo))
  ) {
    throw new ErrorAutenticacion(
      400,
      "Los campos del registro no son válidos."
    );
  }

  const leerTexto = (campo: string, maximo: number) => {
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
  };

  const nombres = leerTexto("nombres", 100);
  const apellidos = leerTexto("apellidos", 100);
  const correo = leerTexto("correo", 254).toLowerCase();
  const numeroDocumento = leerTexto("numero_documento", 10);
  const telefono = leerTexto("telefono", 10);
  const clave = datos.clave;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    throw new ErrorAutenticacion(400, "El correo no es válido.");
  }

  if (!/^\d{10}$/.test(numeroDocumento)) {
    throw new ErrorAutenticacion(
      400,
      "La cédula debe contener exactamente 10 dígitos."
    );
  }

  if (!/^09\d{8}$/.test(telefono)) {
    throw new ErrorAutenticacion(
      400,
      "El celular debe comenzar con 09 y tener 10 dígitos."
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

  const cooperativa = await prisma.cooperativas.findUnique({
    where: { id: cooperativaId },
    select: { activa: true },
  });

  if (!cooperativa || !cooperativa.activa) {
    throw new ErrorAutenticacion(
      409,
      "La cooperativa no está disponible."
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
          numero_documento: numeroDocumento,
        },
      ],
    },
    select: { id: true },
  });

  if (existente) {
    throw new ErrorAutenticacion(
      409,
      "Ya existe una cuenta con ese correo o documento."
    );
  }

  const codigo = randomInt(0, 1000000)
    .toString()
    .padStart(6, "0");

  const [passwordHash, codigoHash] = await Promise.all([
    bcrypt.hash(clave, 12),
    bcrypt.hash(codigo, 12),
  ]);

  const venceEn = new Date(Date.now() + 10 * 60 * 1000);

  const registro = await prisma
    .$transaction(async (tx) => {
      const usuario = await tx.usuarios.create({
        data: {
          nombres,
          apellidos,
          correo,
          tipo_documento: "CEDULA",
          pais_documento: "EC",
          numero_documento: numeroDocumento,
          telefono,
          password_hash: passwordHash,
          activo: true,
          correo_verificado_en: null,
          miembros_cooperativa: {
            create: {
              cooperativa_id: cooperativaId,
              rol: "OFICINISTA",
              activo: true,
            },
          },
        },
        select: {
          id: true,
          nombres: true,
          apellidos: true,
          correo: true,
        },
      });

      const verificacion = await tx.tokens_acceso.create({
        data: {
          usuario_id: usuario.id,
          proposito: "VERIFICAR_CORREO",
          token_hash: codigoHash,
          vence_en: venceEn,
        },
        select: { id: true },
      });

      return {
        usuario,
        verificacionId: verificacion.id,
      };
    })
    .catch((error: unknown) => {
      if (
        error !== null &&
        typeof error === "object" &&
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
    await enviarCodigoVerificacion(
      correo,
      codigo,
      venceEn
    );
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
      "El oficinista fue registrado, pero no se pudo enviar el correo. Debe solicitar un nuevo código."
    );
  }

  return {
    ...registro.usuario,
    cooperativa_id: cooperativaId,
    correo_verificado: false,
    verificacionId: registro.verificacionId,
    venceEn: venceEn.toISOString(),
  };
}
