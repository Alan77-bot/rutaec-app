import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma.js";
import { enviarCodigoVerificacion } from "../usuarios/correo.service.js";
import { ErrorAutenticacion } from "../usuarios/usuarios.service.js";
export async function obtenerGerentes() {
  return prisma.miembros_cooperativa.findMany({
    where: {
      rol: "GERENTE",
    },
    select: {
      cooperativa_id: true,
      usuario_id: true,
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
      cooperativas: {
        select: {
          id: true,
          razon_social: true,
          nombre_comercial: true,
          activa: true,
        },
      },
    },
    orderBy: {
      asignado_en: "desc",
    },
  });
}


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

function validarDatosGerente(entrada: unknown) {
  if (
    !entrada ||
    typeof entrada !== "object" ||
    Array.isArray(entrada)
  ) {
    throw new ErrorAutenticacion(
      400,
      "Los datos del gerente no son válidos."
    );
  }

  const datos = entrada as Record<string, unknown>;

  const nombres = leerTexto(datos, "nombres", 100);
  const apellidos = leerTexto(datos, "apellidos", 100);
  const correo = leerTexto(datos, "correo", 254).toLowerCase();
  const numero_documento = leerTexto(datos, "numero_documento", 10);
  const telefono = leerTexto(datos, "telefono", 10);
  const cooperativa_id = leerTexto(datos, "cooperativa_id", 36);
  const clave = datos.clave;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    throw new ErrorAutenticacion(400, "El correo no es válido.");
  }

  if (!/^\d{10}$/.test(numero_documento)) {
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
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      cooperativa_id
    )
  ) {
    throw new ErrorAutenticacion(
      400,
      "El identificador de la cooperativa no es válido."
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

  return {
    nombres,
    apellidos,
    correo,
    numero_documento,
    telefono,
    cooperativa_id,
    clave,
  };
}

export async function registrarGerente(entrada: unknown) {
  const datos = validarDatosGerente(entrada);

  const cooperativa = await prisma.cooperativas.findUnique({
    where: { id: datos.cooperativa_id },
    select: { id: true, activa: true },
  });

  if (!cooperativa) {
    throw new ErrorAutenticacion(404, "La cooperativa no existe.");
  }

  if (!cooperativa.activa) {
    throw new ErrorAutenticacion(
      409,
      "No se puede asignar un gerente a una cooperativa desactivada."
    );
  }

  const existente = await prisma.usuarios.findFirst({
    where: {
      OR: [
        {
          correo: {
            equals: datos.correo,
            mode: "insensitive",
          },
        },
        {
          pais_documento: "EC",
          tipo_documento: "CEDULA",
          numero_documento: datos.numero_documento,
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

  const codigo = randomInt(0, 1000000).toString().padStart(6, "0");

  const [passwordHash, codigoHash] = await Promise.all([
    bcrypt.hash(datos.clave, 12),
    bcrypt.hash(codigo, 12),
  ]);

  const venceEn = new Date(Date.now() + DURACION_CODIGO_MS);

  const registro = await prisma.$transaction(async (tx) => {
    const usuario = await tx.usuarios.create({
      data: {
        nombres: datos.nombres,
        apellidos: datos.apellidos,
        correo: datos.correo,
        tipo_documento: "CEDULA",
        pais_documento: "EC",
        numero_documento: datos.numero_documento,
        telefono: datos.telefono,
        password_hash: passwordHash,
        activo: true,
        correo_verificado_en: null,
        miembros_cooperativa: {
          create: {
            cooperativa_id: datos.cooperativa_id,
            rol: "GERENTE",
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
  }).catch((error: unknown) => {
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
      datos.correo,
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
      "El gerente fue registrado, pero no se pudo enviar el correo. Debe solicitar un nuevo código."
    );
  }

  return {
    ...registro.usuario,
    cooperativa_id: datos.cooperativa_id,
    correo_verificado: false,
    verificacionId: registro.verificacionId,
    venceEn: venceEn.toISOString(),
  };
}

export async function actualizarGerente(
  id: string,
  entrada: unknown
) {
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuid.test(id)) {
    throw new ErrorAutenticacion(
      400,
      "El identificador del gerente no es válido."
    );
  }

  if (
    !entrada ||
    typeof entrada !== "object" ||
    Array.isArray(entrada)
  ) {
    throw new ErrorAutenticacion(
      400,
      "Debes proporcionar la nueva cooperativa."
    );
  }

  const datos = entrada as Record<string, unknown>;

  if (
    Object.keys(datos).length !== 1 ||
    typeof datos.cooperativa_id !== "string" ||
    !uuid.test(datos.cooperativa_id)
  ) {
    throw new ErrorAutenticacion(
      400,
      "Debes enviar únicamente una cooperativa_id válida."
    );
  }

  return prisma.$transaction(async (tx) => {
    const asignaciones = await tx.miembros_cooperativa.findMany({
      where: {
        usuario_id: id,
        rol: "GERENTE",
      },
    });

    if (asignaciones.length === 0) {
      throw new ErrorAutenticacion(
        404,
        "El gerente no existe."
      );
    }

    const cooperativa = await tx.cooperativas.findUnique({
      where: {
        id: datos.cooperativa_id as string,
      },
      select: {
        id: true,
        activa: true,
      },
    });

    if (!cooperativa) {
      throw new ErrorAutenticacion(
        404,
        "La cooperativa de destino no existe."
      );
    }

    if (!cooperativa.activa) {
      throw new ErrorAutenticacion(
        409,
        "No puedes asignar un gerente a una cooperativa desactivada."
      );
    }

    const asignacionesActivas =
  await tx.miembros_cooperativa.findMany({
    where: {
      usuario_id: id,
      activo: true,
    },
  });

if (
  asignacionesActivas.some(
    (asignacion) => asignacion.rol !== "GERENTE"
  )
) {
  throw new ErrorAutenticacion(
    409,
    "El usuario tiene otro rol activo en una cooperativa."
  );
}

const asignacionActual =
  asignaciones.find((a) => a.activo) ??
  asignaciones[0];

if (asignacionActual.cooperativa_id === cooperativa.id) {
  return asignacionActual;
}

const asignacionDestino =
  await tx.miembros_cooperativa.findUnique({
    where: {
      cooperativa_id_usuario_id: {
        cooperativa_id: cooperativa.id,
        usuario_id: id,
      },
    },
  });

if (
  asignacionDestino &&
  asignacionDestino.rol !== "GERENTE"
) {
  throw new ErrorAutenticacion(
    409,
    "El usuario ya tiene otro rol registrado en la cooperativa de destino."
  );
}

    await tx.miembros_cooperativa.updateMany({
      where: {
        usuario_id: id,
        rol: "GERENTE",
        activo: true,
      },
      data: {
        activo: false,
      },
    });

    return tx.miembros_cooperativa.upsert({
      where: {
        cooperativa_id_usuario_id: {
          cooperativa_id: cooperativa.id,
          usuario_id: id,
        },
      },
      update: {
        rol: "GERENTE",
        activo: asignacionActual.activo,
      },
      create: {
        cooperativa_id: cooperativa.id,
        usuario_id: id,
        rol: "GERENTE",
        activo: asignacionActual.activo,
      },
    });
  });
}


export async function actualizarEstadoGerente(
  id: string,
  entrada: unknown
) {
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuid.test(id)) {
    throw new ErrorAutenticacion(
      400,
      "El identificador del gerente no es válido."
    );
  }

  if (
    !entrada ||
    typeof entrada !== "object" ||
    Array.isArray(entrada)
  ) {
    throw new ErrorAutenticacion(
      400,
      "Debes indicar el estado y la cooperativa del gerente."
    );
  }

  const datos = entrada as Record<string, unknown>;

  if (
    Object.keys(datos).length !== 2 ||
    typeof datos.activo !== "boolean" ||
    typeof datos.cooperativa_id !== "string" ||
    !uuid.test(datos.cooperativa_id)
  ) {
    throw new ErrorAutenticacion(
      400,
      "Debes enviar activo (booleano) y cooperativa_id (UUID válido)."
    );
  }

  const cooperativaId = datos.cooperativa_id;
  const activar = datos.activo;

  return prisma.$transaction(async (tx) => {
    const asignacion = await tx.miembros_cooperativa.findUnique({
      where: {
        cooperativa_id_usuario_id: {
          cooperativa_id: cooperativaId,
          usuario_id: id,
        },
      },
    });

    if (!asignacion || asignacion.rol !== "GERENTE") {
      throw new ErrorAutenticacion(
        404,
        "No existe una asignación de gerente para esa cooperativa."
      );
    }

    if (!activar) {
      return tx.miembros_cooperativa.update({
        where: {
          cooperativa_id_usuario_id: {
            cooperativa_id: cooperativaId,
            usuario_id: id,
          },
        },
        data: {
          activo: false,
        },
      });
    }

    const usuario = await tx.usuarios.findUnique({
      where: { id },
      select: {
        activo: true,
        correo_verificado_en: true,
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

    if (!usuario.activo || !usuario.correo_verificado_en) {
      throw new ErrorAutenticacion(
        409,
        "Para activar al gerente, su cuenta debe estar activa y su correo verificado."
      );
    }

    if (
      usuario.roles_globales.some(
        (r) => r.rol === "ADMINISTRADOR"
      )
    ) {
      throw new ErrorAutenticacion(
        409,
        "Un administrador no puede ser asignado como gerente."
      );
    }

    const cooperativa = await tx.cooperativas.findUnique({
      where: { id: cooperativaId },
      select: { activa: true },
    });

    if (!cooperativa?.activa) {
      throw new ErrorAutenticacion(
        409,
        "No puedes activar un gerente de una cooperativa desactivada."
      );
    }

    const otrasAsignacionesActivas =
      await tx.miembros_cooperativa.findMany({
        where: {
          usuario_id: id,
          activo: true,
          cooperativa_id: {
            not: cooperativaId,
          },
        },
      });

    if (otrasAsignacionesActivas.length > 0) {
      throw new ErrorAutenticacion(
        409,
        "El usuario ya tiene una asignación activa en otra cooperativa. Desactívala antes de continuar."
      );
    }

    const gerenteActualizado =
      await tx.miembros_cooperativa.update({
        where: {
          cooperativa_id_usuario_id: {
            cooperativa_id: cooperativaId,
            usuario_id: id,
          },
        },
        data: {
          activo: true,
        },
      });

    // Un gerente activo no debe conservar el rol global CLIENTE.
    await tx.roles_globales.deleteMany({
      where: {
        usuario_id: id,
        rol: "CLIENTE",
      },
    });

    return gerenteActualizado;
  });
}


export async function obtenerUsuariosDisponibles() {
  return prisma.usuarios.findMany({
    select: {
      id: true,
      nombres: true,
      apellidos: true,
      correo: true,
      numero_documento: true,
      telefono: true,
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
          cooperativas: {
            select: {
              nombre_comercial: true,
              activa: true,
            },
          },
        },
      },
    },
    orderBy: [
      { nombres: "asc" },
      { apellidos: "asc" },
    ],
  });


}

export async function asignarGerenteExistente(
  entrada: unknown
) {
  if (
    !entrada ||
    typeof entrada !== "object" ||
    Array.isArray(entrada)
  ) {
    throw new ErrorAutenticacion(
      400,
      "Los datos de asignación no son válidos."
    );
  }

  const datos = entrada as Record<string, unknown>;

  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (
    Object.keys(datos).length !== 2 ||
    typeof datos.usuario_id !== "string" ||
    typeof datos.cooperativa_id !== "string" ||
    !uuid.test(datos.usuario_id) ||
    !uuid.test(datos.cooperativa_id)
  ) {
    throw new ErrorAutenticacion(
      400,
      "Debes enviar usuario_id y cooperativa_id válidos."
    );
  }

  const usuarioId = datos.usuario_id;
  const cooperativaId = datos.cooperativa_id;

  return prisma.$transaction(async (tx) => {
    const usuario = await tx.usuarios.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        activo: true,
        correo_verificado_en: true,
        roles_globales: {
          select: { rol: true },
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

    if (!usuario.activo || !usuario.correo_verificado_en) {
      throw new ErrorAutenticacion(
        409,
        "El usuario debe tener su cuenta activa y correo verificado."
      );
    }

    if (
      usuario.roles_globales.some(
        (asignacion) => asignacion.rol === "ADMINISTRADOR"
      )
    ) {
      throw new ErrorAutenticacion(
        409,
        "No puedes asignar como gerente a un administrador."
      );
    }

    if (
      usuario.miembros_cooperativa.some(
        (asignacion) => asignacion.activo
      )
    ) {
      throw new ErrorAutenticacion(
        409,
        "El usuario ya tiene una asignación activa a una cooperativa."
      );
    }

    const cooperativa = await tx.cooperativas.findUnique({
      where: { id: cooperativaId },
      select: {
        id: true,
        activa: true,
      },
    });

    if (!cooperativa) {
      throw new ErrorAutenticacion(
        404,
        "La cooperativa no existe."
      );
    }

    if (!cooperativa.activa) {
      throw new ErrorAutenticacion(
        409,
        "No puedes asignar un gerente a una cooperativa desactivada."
      );
    }

    const asignacionAnterior =
      usuario.miembros_cooperativa.find(
        (asignacion) =>
          asignacion.cooperativa_id === cooperativaId
      );

    if (
      asignacionAnterior &&
      asignacionAnterior.rol !== "GERENTE"
    ) {
      throw new ErrorAutenticacion(
        409,
        "El usuario ya tiene otro rol registrado en esta cooperativa."
      );
    }

    
const asignacion = await tx.miembros_cooperativa.upsert({
  where: {
    cooperativa_id_usuario_id: {
      cooperativa_id: cooperativaId,
      usuario_id: usuarioId,
    },
  },
  update: {
    rol: "GERENTE",
    activo: true,
  },
  create: {
    cooperativa_id: cooperativaId,
    usuario_id: usuarioId,
    rol: "GERENTE",
    activo: true,
  },
});

// El usuario deja de ser CLIENTE al convertirse en GERENTE.
await tx.roles_globales.deleteMany({
  where: {
    usuario_id: usuarioId,
    rol: "CLIENTE",
  },
});

return asignacion;

  });
}