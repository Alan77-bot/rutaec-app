import { createHash, randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import type { SesionAutenticada } from "../../middlewares/autenticacion.js";
import { almacenComprobantes } from "./almacenamiento.js";
import { ErrorPago } from "./pagos.service.js";

export const TAMANO_MAXIMO = 5 * 1024 * 1024;

const EXTENSIONES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
} as const;

type TipoArchivo = keyof typeof EXTENSIONES;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FIRMA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function uuidValido(valor: unknown): valor is string {
  return typeof valor === "string" && UUID_RE.test(valor);
}

function tipoReal(datos: Buffer): TipoArchivo | null {
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

function leerCampos(campos: Record<string, unknown>) {
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

function mapearErrorBD(error: unknown): ErrorPago | null {
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

export async function registrarPagoConComprobante(
  usuarioId: string,
  archivo: { buffer: Buffer; originalname: string } | undefined,
  campos: Record<string, unknown>
) {
  const datos = leerCampos(campos);
  if (!archivo) {
    throw new ErrorPago(400, "Debes adjuntar el comprobante en el campo archivo");
  }
  const tipo = tipoReal(archivo.buffer);
  if (!tipo) {
    throw new ErrorPago(400, "El archivo debe ser JPG, PNG o PDF");
  }

  const compra = await prisma.compras.findFirst({
    where: { id: datos.compraId, comprador_id: usuarioId },
    select: { id: true, cooperativa_id: true },
  });
  if (!compra) {
    throw new ErrorPago(404, "La compra no existe");
  }

  const previo = await prisma.pagos.findUnique({
    where: { clave_idempotencia: datos.idempotencia },
    select: { id: true, compra_id: true, estado: true },
  });
  if (previo) {
    if (previo.compra_id !== compra.id) {
      throw new ErrorPago(409, "La clave de idempotencia ya se uso en otra compra");
    }
    return { creado: false, pago_id: previo.id, estado_pago: previo.estado };
  }

  const clave = `comprobantes/${compra.id}/${randomUUID()}.${EXTENSIONES[tipo]}`;
  await almacenComprobantes.guardar(clave, archivo.buffer);

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`select set_config('app.usuario_id', ${usuarioId}, true)`;

      const registro = await tx.archivos.create({
        data: {
          propietario_id: usuarioId,
          cooperativa_id: compra.cooperativa_id,
          objeto_clave: clave,
          finalidad: "COMPROBANTE",
          nombre_original: archivo.originalname.slice(0, 120),
          mime_type: tipo,
          tamano_bytes: BigInt(archivo.buffer.length),
          sha256: createHash("sha256").update(archivo.buffer).digest("hex"),
          estado: "DISPONIBLE",
          privado: true,
        },
      });

      const filas = await tx.$queryRaw<{ pago_id: string | null }[]>`
        select rutaec.recibir_comprobante(
          ${compra.id}::uuid, ${datos.cuentaId}::uuid, ${datos.metodo}::text,
          ${registro.id}::uuid, ${datos.numero}::text, ${datos.fechaTexto}::date,
          ${datos.importe}::numeric, ${datos.idempotencia}::uuid
        ) as pago_id`;
      const pagoId = filas[0]?.pago_id ?? null;

      if (!pagoId) {
        await tx.archivos.update({
          where: { id: registro.id },
          data: { estado: "ELIMINADO", eliminado_en: new Date() },
        });
        return { vencida: true as const };
      }

      const pago = await tx.pagos.findUnique({
        where: { id: pagoId },
        select: { estado: true },
      });
      const compraActual = await tx.compras.findUnique({
        where: { id: compra.id },
        select: { estado: true },
      });
      const revision = await tx.revisiones.findFirst({
        where: { pago_id: pagoId },
        select: { id: true, estado: true },
      });

      return {
        vencida: false as const,
        creado: true,
        pago_id: pagoId,
        estado_pago: pago?.estado ?? null,
        estado_compra: compraActual?.estado ?? null,
        revision_id: revision?.id ?? null,
        estado_revision: revision?.estado ?? null,
        numero_referencia: datos.numero,
        importe_declarado: datos.importe,
        archivo: {
          nombre: registro.nombre_original,
          tipo,
          tamano_bytes: archivo.buffer.length,
        },
      };
    });

    if (resultado.vencida) {
      await almacenComprobantes.eliminar(clave);
      throw new ErrorPago(409, "La reserva de la compra ya vencio");
    }
    return resultado;
  } catch (error) {
    await almacenComprobantes.eliminar(clave);
    if (error instanceof ErrorPago) throw error;
    throw mapearErrorBD(error) ?? error;
  }
}

export async function abrirComprobante(
  sesion: SesionAutenticada,
  pagoId: string
) {
  if (!UUID_RE.test(pagoId)) {
    throw new ErrorPago(400, "id de pago invalido");
  }

  const pago = await prisma.pagos.findUnique({
    where: { id: pagoId },
    include: { compras: { select: { comprador_id: true } } },
  });

  const esDueno = pago?.compras.comprador_id === sesion.id;
  const esPersonal =
    sesion.rol === "admin" ||
    ((sesion.rol === "cooperativa" || sesion.rol === "oficinista") &&
      !!sesion.coopId &&
      sesion.coopId.toLowerCase() === pago?.cooperativa_id.toLowerCase());

  if (!pago || (!esDueno && !esPersonal)) {
    throw new ErrorPago(404, "El comprobante no existe");
  }

  const comprobante = await prisma.comprobantes_pago.findFirst({
    where: { pago_id: pago.id },
    orderBy: { recibido_en: "desc" },
    select: { archivo_id: true },
  });
  if (!comprobante) {
    throw new ErrorPago(404, "El comprobante no existe");
  }

  const archivo = await prisma.archivos.findUnique({
    where: { id: comprobante.archivo_id },
    select: { objeto_clave: true, mime_type: true, estado: true },
  });
  if (!archivo || archivo.estado !== "DISPONIBLE") {
    throw new ErrorPago(404, "El comprobante no existe");
  }

  return {
    flujo: almacenComprobantes.abrir(archivo.objeto_clave),
    tipo: archivo.mime_type,
  };
}
