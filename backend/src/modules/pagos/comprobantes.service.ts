import { createHash, randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
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

  return { numero, fecha, importe: importe.toFixed(2) };
}

export async function subirComprobante(
  usuarioId: string,
  pagoId: string,
  archivo: { buffer: Buffer; originalname: string } | undefined,
  campos: Record<string, unknown>
) {
  if (!UUID_RE.test(pagoId)) {
    throw new ErrorPago(400, "id de pago invalido");
  }
  if (!archivo) {
    throw new ErrorPago(400, "Debes adjuntar el comprobante en el campo archivo");
  }
  const datos = leerCampos(campos);
  const tipo = tipoReal(archivo.buffer);
  if (!tipo) {
    throw new ErrorPago(400, "El archivo debe ser JPG, PNG o PDF");
  }

  const pago = await prisma.pagos.findUnique({
    where: { id: pagoId },
    include: {
      compras: { select: { comprador_id: true } },
      comprobantes_pago: { select: { id: true }, take: 1 },
    },
  });
  if (!pago || pago.compras.comprador_id !== usuarioId) {
    throw new ErrorPago(404, "El pago no existe");
  }
  if (pago.estado !== "PENDIENTE" && pago.estado !== "CORRECCION") {
    throw new ErrorPago(409, "El pago no admite comprobante en su estado actual");
  }
  if (pago.estado === "PENDIENTE" && pago.comprobantes_pago.length > 0) {
    throw new ErrorPago(409, "El pago ya tiene un comprobante");
  }

  const clave = `comprobantes/${pago.id}/${randomUUID()}.${EXTENSIONES[tipo]}`;
  await almacenComprobantes.guardar(clave, archivo.buffer);

  try {
    return await prisma.$transaction(async (tx) => {
      const registro = await tx.archivos.create({
        data: {
          propietario_id: usuarioId,
          cooperativa_id: pago.cooperativa_id,
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
      const comprobante = await tx.comprobantes_pago.create({
        data: {
          pago_id: pago.id,
          archivo_id: registro.id,
          numero_referencia: datos.numero,
          fecha_operacion: datos.fecha,
          importe_declarado: datos.importe,
        },
      });
      const cambio = await tx.pagos.updateMany({
        where: { id: pago.id, estado: pago.estado },
        data: { estado: "EN_REVISION" },
      });
      if (cambio.count !== 1) {
        throw new ErrorPago(409, "El pago cambio de estado, intenta de nuevo");
      }
      return {
        comprobante_id: comprobante.id,
        pago_id: pago.id,
        estado_pago: "EN_REVISION",
        numero_referencia: comprobante.numero_referencia,
        importe_declarado: datos.importe,
        archivo: {
          nombre: registro.nombre_original,
          tipo,
          tamano_bytes: archivo.buffer.length,
        },
      };
    });
  } catch (error) {
    await almacenComprobantes.eliminar(clave);
    throw error;
  }
}
