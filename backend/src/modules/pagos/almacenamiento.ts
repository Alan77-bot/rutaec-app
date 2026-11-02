import { createReadStream } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";

export interface AlmacenArchivos {
  guardar(clave: string, datos: Buffer): Promise<void>;
  abrir(clave: string): Readable;
  eliminar(clave: string): Promise<void>;
}

const CLAVE_VALIDA = /^[a-z0-9][a-z0-9/_-]*\.(jpg|png|pdf)$/i;

class AlmacenLocal implements AlmacenArchivos {
  private base: string;

  constructor(base: string) {
    this.base = path.resolve(base);
  }

  private ruta(clave: string): string {
    if (!CLAVE_VALIDA.test(clave) || clave.includes("..")) {
      throw new Error("Clave de archivo invalida");
    }
    const destino = path.resolve(this.base, clave);
    if (!destino.startsWith(this.base + path.sep)) {
      throw new Error("Clave de archivo invalida");
    }
    return destino;
  }

  async guardar(clave: string, datos: Buffer): Promise<void> {
    const destino = this.ruta(clave);
    await mkdir(path.dirname(destino), { recursive: true });
    await writeFile(destino, datos, { flag: "wx", mode: 0o600 });
  }

  abrir(clave: string): Readable {
    return createReadStream(this.ruta(clave));
  }

  async eliminar(clave: string): Promise<void> {
    await unlink(this.ruta(clave)).catch(() => undefined);
  }
}

const DIRECTORIO =
  process.env.COMPROBANTES_DIR ??
  path.resolve(process.cwd(), "storage", "comprobantes");

export const almacenComprobantes: AlmacenArchivos = new AlmacenLocal(DIRECTORIO);
