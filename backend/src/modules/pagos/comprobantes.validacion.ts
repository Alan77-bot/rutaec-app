// Validaciones puras del comprobante de pago (sin acceso a la base de datos),
// separadas del servicio para poder probarlas con pruebas unitarias.
import { ErrorPago } from "./errores.js";

export const TAMANO_MAXIMO = 5 * 1024 * 1024;

export const EXTENSIONES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
} as const;

export type TipoArchivo = keyof typeof EXTENSIONES;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FIRMA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function uuidValido(valor: unknown): valor is string {
  return typeof valor === "string" && UUID_RE.test(valor);
}

export function tipoReal(datos: Buffer): TipoArchivo | null {
  if (datos.length > 3 && datos[0] === 0xff && datos[1] === 0xd8 && datos[2] === 0xff) {
    return "image/jpeg";
  }
  if (datos.length > 8 && datos.subarray(0, 8).equals(FIRMA_PNG)) {
    return "image/png";
  }
  if (datos.length > 5 && datos.subarray(0, 5).toString("latin1") === "%PDF-") {
    return "application/pdf";
  }
  return null;
}

export function leerCampos(campos: Record<string, unknown>) {
  const compraId = campos.compra_id;
  const cuentaId = campos.cuenta_bancaria_id;
  const idempotencia = campos.clave_idempotencia;
  const metodo = String(campos.metodo ?? "");

  if (!uuidValido(compraId)) throw new ErrorPago(400, "compra_id invalido");
  if (metodo !== "DEPOSITO" && metodo !== "TRANSFERENCIA") {
    throw new ErrorPago(400, "metodo debe ser DEPOSITO o TRANSFERENCIA");
  }
  if (!uuidValido(cuentaId)) {
    throw new ErrorPago(400, "cuenta_bancaria_id invalido");
  }
  if (!uuidValido(idempotencia)) {
    throw new ErrorPago(400, "clave_idempotencia invalida");
  }

  const numero =
    typeof campos.numero_referencia === "string"
      ? campos.numero_referencia.trim()
      : "";
  if (numero.length < 3 || numero.length > 40) {
    throw new ErrorPago(400, "numero_referencia invalido");
  }

  const fechaTexto =
    typeof campos.fecha_operacion === "string" ? campos.fecha_operacion : "";
  const fecha = new Date(`${fechaTexto}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(fechaTexto) ||
    Number.isNaN(fecha.getTime()) ||
    fecha.toISOString().slice(0, 10) !== fechaTexto
  ) {
    throw new ErrorPago(400, "fecha_operacion debe tener formato AAAA-MM-DD");
  }
  if (fecha.getTime() > Date.now()) {
    throw new ErrorPago(400, "fecha_operacion no puede ser futura");
  }

  const importe = Number(campos.importe_declarado);
  if (!Number.isFinite(importe) || importe <= 0 || importe > 99999999) {
    throw new ErrorPago(400, "importe_declarado invalido");
  }

  return {
    compraId,
    cuentaId,
    idempotencia,
    metodo,
    numero,
    fechaTexto,
    importe: importe.toFixed(2),
  };
}

export function mapearErrorBD(error: unknown): ErrorPago | null {
  const bruto = error as { meta?: { message?: unknown }; message?: unknown };
  const texto = String(bruto?.meta?.message ?? bruto?.message ?? "");
  if (texto.includes("Sin permiso") || texto.includes("returned no rows")) {
    return new ErrorPago(404, "La compra no existe");
  }
  if (texto.includes("no admite comprobante inicial")) {
    return new ErrorPago(409, "La compra no admite un comprobante en su estado actual");
  }
  if (texto.includes("Clave idempotente reutilizada")) {
    return new ErrorPago(409, "La clave de idempotencia ya se uso con otros datos");
  }
  if (texto.includes("pago_abierto_uq")) {
    return new ErrorPago(409, "La compra ya tiene un pago abierto");
  }
  if (texto.includes("Cuenta bancaria no habilitada")) {
    return new ErrorPago(400, "La cuenta bancaria no pertenece a la cooperativa o esta inactiva");
  }
  if (/todo\/importe/.test(texto)) {
    return new ErrorPago(400, "Metodo o importe invalido");
  }
  if (texto.includes("Archivo no disponible")) {
    return new ErrorPago(400, "El archivo no esta disponible");
  }
  return null;
}
