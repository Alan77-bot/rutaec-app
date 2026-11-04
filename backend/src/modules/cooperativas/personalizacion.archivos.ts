import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../../lib/prisma.js';

export async function leerLogoPublico(id?: string | null): Promise<Buffer | null> {
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const archivo = await prisma.archivos.findFirst({ where: { id, finalidad: 'LOGO', privado: false, estado: 'DISPONIBLE' } });
  if (!archivo || !/^personalizacion\/[a-f0-9-]+\.(png|jpg)$/.test(archivo.objeto_clave)) return null;
  const base = path.resolve(process.env.PERSONALIZACION_DIR ?? 'storage/personalizacion');
  return readFile(path.join(base, path.basename(archivo.objeto_clave))).catch(() => null);
}
