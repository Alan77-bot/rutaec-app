
import { prisma } from "../../lib/prisma.js";

export async function listarCooperativas() {
  return prisma.cooperativas.findMany({
    select: {
      id: true,
      nombre_comercial: true,
      razon_social: true,
      activa: true,
    },
  });
}



export interface DatosNuevaCooperativa {
  ruc: string;
  razon_social: string;
  nombre_comercial: string;
  correo: string;
  telefono: string;
  direccion: string;
}

export async function registrarCooperativa(
  datos: DatosNuevaCooperativa
) {
  return prisma.cooperativas.create({
    data: {
      ruc: datos.ruc.trim(),
      razon_social: datos.razon_social.trim(),
      nombre_comercial: datos.nombre_comercial.trim(),
      correo: datos.correo.trim(),
      telefono: datos.telefono.trim(),
      direccion: datos.direccion.trim(),
    },
    select: {
      id: true,
      ruc: true,
      razon_social: true,
      nombre_comercial: true,
      correo: true,
      telefono: true,
      direccion: true,
      activa: true,
    },
  });
}
