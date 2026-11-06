import { createHash, randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import type { SesionAutenticada } from "../../middlewares/autenticacion.js";
import { almacenComprobantes } from "./almacenamiento.js";
import { ErrorPago } from "./errores.js";
import {
  EXTENSIONES,
  leerCampos,
  mapearErrorBD,
  tipoReal,
  uuidValido,
} from "./comprobantes.validacion.js";

export { TAMANO_MAXIMO } from "./comprobantes.validacion.js";

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
  if (!uuidValido(pagoId)) {
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
