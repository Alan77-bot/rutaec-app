import { prisma } from "../../lib/prisma.js";

export async function listarBusesPorCooperativa(cooperativaId: string) {
  return prisma.buses.findMany({
    where: { cooperativa_id: cooperativaId },
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
            select: { nombre: true },
          },
        },
      },
    },
    orderBy: { numero_unidad: "asc" },
  });
}

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
}

export async function registrarBus(datos: DatosRegistroBus) {
  const grupo = await prisma.grupos_buses.findFirst({
    where: {
      id: datos.grupoId,
      cooperativa_id: datos.cooperativaId,
      activo: true,
    },
    select: { id: true },
  });

  if (!grupo) {
    return {
      error: "El grupo no existe, está inactivo o no pertenece a la cooperativa",
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
    },
  });

  return { bus };
}


export async function listarGruposBuses(cooperativaId: string) {
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
    orderBy: { nombre: "asc" },
  });
}



export type DatosEdicionBus = Partial<
  Omit<DatosRegistroBus, "cooperativaId">
>;

export async function actualizarBus(
  busId: string,
  cooperativaId: string,
  datos: DatosEdicionBus
) {
  // Comprueba que el bus pertenezca a la cooperativa.
  const existente = await prisma.buses.findFirst({
    where: {
      id: busId,
      cooperativa_id: cooperativaId,
    },
    select: { id: true },
  });

  if (!existente) {
    return {
      error: "El bus no existe o no pertenece a la cooperativa",
      estado: 404,
    };
  }

  // Si cambia el grupo, verifica que sea válido.
  if (datos.grupoId !== undefined) {
    const grupo = await prisma.grupos_buses.findFirst({
      where: {
        id: datos.grupoId,
        cooperativa_id: cooperativaId,
        activo: true,
      },
      select: { id: true },
    });

    if (!grupo) {
      return {
        error: "El grupo no existe, está inactivo o no pertenece a la cooperativa",
        estado: 400,
      };
    }
  }

  // Actualiza solo los campos recibidos.
  const bus = await prisma.buses.update({
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

  return { bus };
}
