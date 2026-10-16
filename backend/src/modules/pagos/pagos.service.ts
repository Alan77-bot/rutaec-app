import { prisma } from "../../lib/prisma.js";

export async function listarPagos() {
  return prisma.pagos.findMany({
    select: {
      id: true,
      compra_id: true,
      cooperativa_id: true,
      metodo: true,
      estado: true,
      importe: true,
      moneda: true,
      creado_en: true,
      aprobado_en: true,
    },
    orderBy: { creado_en: "desc" },
  });
}

export async function listarPagosPendientes() {
  return prisma.pagos.findMany({
    where: { estado: { in: ["PENDIENTE", "EN_REVISION"] } },
    orderBy: { creado_en: "asc" },
  });
}

const METODOS_MANUALES = ["DEPOSITO", "TRANSFERENCIA"];
const ESTADO_COMPRA_PAGABLE = "RESERVADA";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ErrorPago extends Error {
  estado: number;
  constructor(estado: number, mensaje: string) {
    super(mensaje);
    this.estado = estado;
  }
}

function uuidValido(valor: unknown): valor is string {
  return typeof valor === "string" && UUID_RE.test(valor);
}

export async function crearPago(datos: Record<string, unknown>) {
  const { compra_id, metodo, cuenta_bancaria_id, clave_idempotencia } = datos;

  if (!uuidValido(compra_id)) {
    throw new ErrorPago(400, "compra_id invalido");
  }
  if (typeof metodo !== "string" || !METODOS_MANUALES.includes(metodo)) {
    throw new ErrorPago(400, "metodo debe ser DEPOSITO o TRANSFERENCIA");
  }
  if (!uuidValido(cuenta_bancaria_id)) {
    throw new ErrorPago(400, "cuenta_bancaria_id invalido");
  }
  if (!uuidValido(clave_idempotencia)) {
    throw new ErrorPago(400, "clave_idempotencia invalida");
  }

  const existente = await prisma.pagos.findUnique({
    where: { clave_idempotencia },
  });
  if (existente) {
    if (existente.compra_id !== compra_id) {
      throw new ErrorPago(409, "La clave de idempotencia ya se uso en otra compra");
    }
    return { pago: existente, creado: false };
  }

  const compra = await prisma.compras.findUnique({
    where: { id: compra_id },
    select: { id: true, cooperativa_id: true, estado: true, total: true },
  });
  if (!compra) {
    throw new ErrorPago(404, "La compra no existe");
  }
  if (compra.estado !== ESTADO_COMPRA_PAGABLE) {
    throw new ErrorPago(409, "La compra no esta en estado pagable");
  }
  if (Number(compra.total) <= 0) {
    throw new ErrorPago(409, "La compra no tiene un total a pagar");
  }

  const cuenta = await prisma.cuentas_bancarias.findFirst({
    where: {
      id: cuenta_bancaria_id,
      cooperativa_id: compra.cooperativa_id,
      activa: true,
    },
    select: { id: true },
  });
  if (!cuenta) {
    throw new ErrorPago(400, "La cuenta bancaria no pertenece a la cooperativa o esta inactiva");
  }

  try {
    const pago = await prisma.pagos.create({
      data: {
        compra_id: compra.id,
        cooperativa_id: compra.cooperativa_id,
        metodo,
        importe: compra.total,
        cuenta_bancaria_id: cuenta.id,
        clave_idempotencia,
      },
    });
    return { pago, creado: true };
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      throw new ErrorPago(409, "La compra ya tiene un pago abierto");
    }
    throw error;
  }
}
