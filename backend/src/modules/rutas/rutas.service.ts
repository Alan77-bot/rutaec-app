import { prisma } from "../../lib/prisma.js";

export async function listarCiudades() {
  return prisma.ciudades.findMany({
    orderBy: [{ provincia: "asc" }, { nombre: "asc" }],
  });
}

export async function listarTerminales() {
  return prisma.terminales.findMany({
    include: {
      ciudades: { select: { nombre: true, provincia: true } },
    },
    orderBy: { nombre: "asc" },
  });
}

export async function listarRutas(rutaId?: string) {
  const rutas = await prisma.rutas.findMany({
    where: rutaId ? { id: rutaId } : {},
    include: {
      cooperativas: { select: { nombre_comercial: true } },
      paradas_ruta: {
        orderBy: { orden: "asc" },
        include: {
          terminales: {
            include: { ciudades: { select: { nombre: true, provincia: true } } },
          },
        },
      },
    },
    orderBy: { nombre: "asc" },
  });

  return rutas.map((ruta) => {
    const paradas = ruta.paradas_ruta;
    return {
      id: ruta.id,
      cooperativa_id: ruta.cooperativa_id,
      cooperativa: ruta.cooperativas.nombre_comercial,
      nombre: ruta.nombre,
      version: ruta.version,
      activa: ruta.activa,
      origen: paradas[0]?.terminales.ciudades.nombre ?? null,
      destino: paradas[paradas.length - 1]?.terminales.ciudades.nombre ?? null,
      paradas: paradas.map((p) => ({
        orden: p.orden,
        terminal_id: p.terminal_id,
        terminal: p.terminales.nombre,
        ciudad: p.terminales.ciudades.nombre,
        minutos_desde_origen: p.minutos_desde_origen,
        permite_subida: p.permite_subida,
        permite_bajada: p.permite_bajada,
      })),
    };
  });
}

export class ErrorRutas extends Error {
  estado: number;

  constructor(estado: number, mensaje: string) {
    super(mensaje);
    this.estado = estado;
  }
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ParadaEntrada {
  terminal_id: string;
  minutos_desde_origen: number;
  permite_subida: boolean;
  permite_bajada: boolean;
}

interface RutaEntrada {
  cooperativa_id: string;
  nombre: string;
  paradas: ParadaEntrada[];
}

function validarParadas(crudas: unknown): ParadaEntrada[] {
  if (!Array.isArray(crudas) || crudas.length < 2) {
    throw new ErrorRutas(400, "La ruta necesita al menos 2 paradas");
  }

  return crudas.map((p: unknown, i: number): ParadaEntrada => {
    if (typeof p !== "object" || p === null) {
      throw new ErrorRutas(400, `La parada ${i + 1} no es valida`);
    }
    const x = p as Record<string, unknown>;
    if (typeof x.terminal_id !== "string" || !UUID.test(x.terminal_id)) {
      throw new ErrorRutas(400, `La parada ${i + 1} necesita un terminal_id valido`);
    }
    const minutos = x.minutos_desde_origen;
    if (typeof minutos !== "number" || !Number.isInteger(minutos) || minutos < 0) {
      throw new ErrorRutas(
        400,
        `La parada ${i + 1} necesita minutos_desde_origen entero y mayor o igual a 0`
      );
    }
    return {
      terminal_id: x.terminal_id,
      minutos_desde_origen: minutos,
      permite_subida: x.permite_subida !== false,
      permite_bajada: x.permite_bajada !== false,
    };
  });
}

async function validarReglasParadas(paradas: ParadaEntrada[]): Promise<void> {
  const primera = paradas[0];
  const ultima = paradas[paradas.length - 1];
  if (!primera || !ultima) {
    throw new ErrorRutas(400, "La ruta necesita al menos 2 paradas");
  }

  if (primera.minutos_desde_origen !== 0) {
    throw new ErrorRutas(400, "La primera parada (origen) debe tener 0 minutos");
  }

  const ids = new Set(paradas.map((p) => p.terminal_id));
  if (ids.size !== paradas.length) {
    throw new ErrorRutas(400, "Una terminal no puede repetirse en la misma ruta");
  }

  for (let i = 1; i < paradas.length; i++) {
    const actual = paradas[i];
    const anterior = paradas[i - 1];
    if (
      actual &&
      anterior &&
      actual.minutos_desde_origen <= anterior.minutos_desde_origen
    ) {
      throw new ErrorRutas(
        400,
        `Los minutos de la parada ${i + 1} deben ser mayores que los de la parada ${i}`
      );
    }
  }

  const terminales = await prisma.terminales.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, ciudad_id: true },
  });
  if (terminales.length !== ids.size) {
    throw new ErrorRutas(400, "Alguna de las terminales no existe");
  }

  const ciudadDe = new Map(
    terminales.map((t): [string, string] => [t.id, t.ciudad_id])
  );
  if (ciudadDe.get(primera.terminal_id) === ciudadDe.get(ultima.terminal_id)) {
    throw new ErrorRutas(400, "El origen y el destino deben ser ciudades distintas");
  }
}

function validarEntrada(datos: unknown): RutaEntrada {
  if (typeof datos !== "object" || datos === null) {
    throw new ErrorRutas(400, "El cuerpo de la peticion es obligatorio");
  }
  const d = datos as Record<string, unknown>;

  const nombre = typeof d.nombre === "string" ? d.nombre.trim() : "";
  if (!nombre) throw new ErrorRutas(400, "El nombre de la ruta es obligatorio");

  if (typeof d.cooperativa_id !== "string" || !UUID.test(d.cooperativa_id)) {
    throw new ErrorRutas(400, "cooperativa_id debe ser un UUID valido");
  }

  return {
    cooperativa_id: d.cooperativa_id,
    nombre,
    paradas: validarParadas(d.paradas),
  };
}

export async function crearRuta(datos: unknown) {
  const entrada = validarEntrada(datos);

  const cooperativa = await prisma.cooperativas.findUnique({
    where: { id: entrada.cooperativa_id },
    select: { id: true },
  });
  if (!cooperativa) throw new ErrorRutas(404, "La cooperativa no existe");

  await validarReglasParadas(entrada.paradas);

  const existente = await prisma.rutas.findFirst({
    where: {
      cooperativa_id: entrada.cooperativa_id,
      nombre: entrada.nombre,
      version: 1,
    },
    select: { id: true },
  });
  if (existente) {
    throw new ErrorRutas(409, "Ya existe una ruta con ese nombre en la cooperativa");
  }

  // El create anidado guarda la ruta y sus paradas en una sola transaccion.
  const creada = await prisma.rutas.create({
    data: {
      cooperativa_id: entrada.cooperativa_id,
      nombre: entrada.nombre,
      version: 1,
      paradas_ruta: {
        create: entrada.paradas.map((p, i) => ({
          orden: i + 1,
          terminal_id: p.terminal_id,
          minutos_desde_origen: p.minutos_desde_origen,
          permite_subida: p.permite_subida,
          permite_bajada: p.permite_bajada,
        })),
      },
    },
    select: { id: true },
  });

  const [ruta] = await listarRutas(creada.id);
  return ruta;
}
