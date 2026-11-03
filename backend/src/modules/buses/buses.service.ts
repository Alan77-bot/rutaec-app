
import { prisma } from "../../lib/prisma.js";

export type EstadoBus =
  | "ACTIVO"
  | "INACTIVO"
  | "MANTENIMIENTO";

// ========================================
// LISTAR BUSES DE UNA COOPERATIVA
// ========================================

export async function listarBusesPorCooperativa(
  cooperativaId: string
) {
  return prisma.buses.findMany({
    where: {
      cooperativa_id: cooperativaId,
    },
    select: {
      id: true,
      cooperativa_id: true,
      grupo_id: true,
      placa: true,
      numero_unidad: true,
      color: true,
      marca_chasis: true,
      marca_carroceria: true,
      anio: true,
      pisos: true,
      capacidad: true,
      imagen_url: true,
      estado: true,
      grupos_buses: {
        select: {
          id: true,
          nombre: true,
          tipo: true,
        },
      },
      bus_comodidades: {
        select: {
          comodidad: true,
          comodidades: {
            select: {
              nombre: true,
            },
          },
        },
      },
    },
    orderBy: {
      numero_unidad: "asc",
    },
  });
}

// ========================================
// LISTAR GRUPOS DE BUSES
// ========================================

export async function listarGruposBuses(
  cooperativaId: string
) {
  return prisma.grupos_buses.findMany({
    where: {
      cooperativa_id: cooperativaId,
      activo: true,
    },
    select: {
      id: true,
      nombre: true,
      tipo: true,
    },
    orderBy: {
      nombre: "asc",
    },
  });
}

// ========================================
// LISTAR CATÁLOGO DE COMODIDADES
// ========================================

export async function listarComodidades() {
  return prisma.comodidades.findMany({
    select: {
      codigo: true,
      nombre: true,
    },
    orderBy: {
      nombre: "asc",
    },
  });
}

// ========================================
// VALIDAR COMODIDADES
// ========================================

async function validarComodidades(
  codigos: string[]
): Promise<
  | { codigos: string[] }
  | { error: string }
> {
  if (
    !Array.isArray(codigos) ||
    codigos.some(
      (codigo) =>
        typeof codigo !== "string" ||
        !codigo.trim()
    )
  ) {
    return {
      error: "Las comodidades enviadas son inválidas",
    };
  }

  const unicos = [...new Set(codigos)];

  if (unicos.length === 0) {
    return {
      codigos: [],
    };
  }

  const existentes = await prisma.comodidades.findMany({
    where: {
      codigo: {
        in: unicos,
      },
    },
    select: {
      codigo: true,
    },
  });

  if (existentes.length !== unicos.length) {
    return {
      error:
        "Una o más comodidades no existen en el catálogo",
    };
  }

  return {
    codigos: unicos,
  };
}

// ========================================
// DATOS PARA REGISTRAR BUS
// ========================================

export interface DatosRegistroBus {
  cooperativaId: string;
  grupoId: string;
  placa: string;
  numeroUnidad: string;
  color: string;
  marcaChasis: string;
  marcaCarroceria: string;
  anio: number | null;
  pisos: number;
  capacidad: number;
  imagenUrl: string | null;
  comodidades: string[];
}

// ========================================
// REGISTRAR BUS
// ========================================

export async function registrarBus(
  datos: DatosRegistroBus
) {
  const grupo = await prisma.grupos_buses.findFirst({
    where: {
      id: datos.grupoId,
      cooperativa_id: datos.cooperativaId,
      activo: true,
    },
    select: {
      id: true,
    },
  });

  if (!grupo) {
    return {
      error:
        "El grupo no existe, está inactivo o no pertenece a la cooperativa",
      estado: 400,
    };
  }

  const validacion = await validarComodidades(
    datos.comodidades
  );

  if ("error" in validacion) {
    return {
      error: validacion.error,
      estado: 400,
    };
  }

  const bus = await prisma.buses.create({
    data: {
      cooperativa_id: datos.cooperativaId,
      grupo_id: datos.grupoId,
      placa: datos.placa,
      numero_unidad: datos.numeroUnidad,
      color: datos.color,
      marca_chasis: datos.marcaChasis,
      marca_carroceria: datos.marcaCarroceria,
      anio: datos.anio,
      pisos: datos.pisos,
      capacidad: datos.capacidad,
      imagen_url: datos.imagenUrl,

      bus_comodidades: {
        create: validacion.codigos.map(
          (codigo) => ({
            comodidad: codigo,
          })
        ),
      },
    },
    include: {
      bus_comodidades: {
        include: {
          comodidades: true,
        },
      },
    },
  });

  return {
    bus,
  };
}

// ========================================
// DATOS PARA EDITAR BUS
// ========================================

export type DatosEdicionBus = Partial<
  Omit<DatosRegistroBus, "cooperativaId">
>;

// ========================================
// EDITAR BUS
// ========================================

export async function actualizarBus(
  busId: string,
  cooperativaId: string,
  datos: DatosEdicionBus
) {
  const existente = await prisma.buses.findFirst({
    where: {
      id: busId,
      cooperativa_id: cooperativaId,
    },
    select: {
      id: true,
    },
  });

  if (!existente) {
    return {
      error:
        "El bus no existe o no pertenece a la cooperativa",
      estado: 404,
    };
  }

  // Validar el nuevo grupo, si se proporciona.
  if (datos.grupoId !== undefined) {
    const grupo = await prisma.grupos_buses.findFirst({
      where: {
        id: datos.grupoId,
        cooperativa_id: cooperativaId,
        activo: true,
      },
      select: {
        id: true,
      },
    });

    if (!grupo) {
      return {
        error:
          "El grupo no existe, está inactivo o no pertenece a la cooperativa",
        estado: 400,
      };
    }
  }

  // Solo reemplazar comodidades cuando se envíen.
  let codigosComodidades: string[] | undefined;

  if (datos.comodidades !== undefined) {
    const validacion = await validarComodidades(
      datos.comodidades
    );

    if ("error" in validacion) {
      return {
        error: validacion.error,
        estado: 400,
      };
    }

    codigosComodidades = validacion.codigos;
  }

  // La edición del bus y sus comodidades
  // se realiza de forma atómica.
  const bus = await prisma.$transaction(
    async (tx) => {
      const actualizado = await tx.buses.update({
        where: {
          id: busId,
          cooperativa_id: cooperativaId,
        },
        data: {
          ...(datos.grupoId !== undefined && {
            grupo_id: datos.grupoId,
          }),

          ...(datos.placa !== undefined && {
            placa: datos.placa,
          }),

          ...(datos.numeroUnidad !== undefined && {
            numero_unidad: datos.numeroUnidad,
          }),

          ...(datos.color !== undefined && {
            color: datos.color,
          }),

          ...(datos.marcaChasis !== undefined && {
            marca_chasis: datos.marcaChasis,
          }),

          ...(datos.marcaCarroceria !== undefined && {
            marca_carroceria: datos.marcaCarroceria,
          }),

          ...(datos.anio !== undefined && {
            anio: datos.anio,
          }),

          ...(datos.pisos !== undefined && {
            pisos: datos.pisos,
          }),

          ...(datos.capacidad !== undefined && {
            capacidad: datos.capacidad,
          }),

          ...(datos.imagenUrl !== undefined && {
            imagen_url: datos.imagenUrl,
          }),
        },
      });

      if (codigosComodidades !== undefined) {
        await tx.bus_comodidades.deleteMany({
          where: {
            bus_id: busId,
          },
        });

        if (codigosComodidades.length > 0) {
          await tx.bus_comodidades.createMany({
            data: codigosComodidades.map(
              (codigo) => ({
                bus_id: busId,
                comodidad: codigo,
              })
            ),
          });
        }
      }

      return actualizado;
    }
  );

  return {
    bus,
  };
}

// ========================================
// CAMBIAR ESTADO DEL BUS
// ========================================

export async function cambiarEstadoBus(
  busId: string,
  cooperativaId: string,
  nuevoEstado: EstadoBus
) {
  return prisma.$transaction(async (tx) => {
    // Bloqueo para coordinar con la programación
    // de viajes y evitar cambios simultáneos.
    const encontrados = await tx.$queryRaw<
      { id: string; estado: string }[]
    >`
      SELECT id, estado
      FROM rutaec.buses
      WHERE id = ${busId}::uuid
        AND cooperativa_id = ${cooperativaId}::uuid
      FOR UPDATE
    `;

    const existente = encontrados[0];

    if (!existente) {
      return {
        error:
          "El bus no existe o no pertenece a la cooperativa",
        estado: 404,
      };
    }

    if (existente.estado === nuevoEstado) {
      return {
        error:
          `El bus ya se encuentra en estado ${nuevoEstado}`,
        estado: 409,
      };
    }

    // No permitir retirar de operación un bus
    // que tiene viajes o asignaciones pendientes.
    if (
      nuevoEstado === "INACTIVO" ||
      nuevoEstado === "MANTENIMIENTO"
    ) {
      const agendaPendiente =
        await tx.agenda_bus.findFirst({
          where: {
            bus_id: busId,
            cooperativa_id: cooperativaId,
            activa: true,
            fin: {
              gt: new Date(),
            },
            OR: [
              {
                viajes: {
                  is: {
                    estado: {
                      not: "CANCELADO",
                    },
                  },
                },
              },
              {
                viajes: {
                  is: null,
                },
              },
            ],
          },
          select: {
            id: true,
          },
        });

      if (agendaPendiente) {
        return {
          error:
            "No puedes cambiar el bus a INACTIVO o MANTENIMIENTO mientras tenga viajes o asignaciones pendientes",
          estado: 409,
        };
      }
    }

    const bus = await tx.buses.update({
      where: {
        id: busId,
        cooperativa_id: cooperativaId,
      },
      data: {
        estado: nuevoEstado,
      },
    });

    return {
      bus,
    };
  });
}
