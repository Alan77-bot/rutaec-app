import { createHash, randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { ErrorAutenticacion } from "./usuarios.service.js";
import { enviarCodigoCambioCorreo } from "./perfil.correo.js";

const camposPerfil = {
  id: true, nombres: true, apellidos: true, telefono: true, correo: true,
  tipo_documento: true, pais_documento: true, numero_documento: true,
} as const;
const error = (mensaje: string, estado = 400) => new ErrorAutenticacion(estado, mensaje);

function datos(entrada: unknown, permitidos: string[]) {
  if (!entrada || typeof entrada !== "object" || Array.isArray(entrada)) throw error("Los datos no son válidos.");
  const resultado = entrada as Record<string, unknown>;
  if (Object.keys(resultado).some(campo => !permitidos.includes(campo))) throw error("El perfil no permite modificar esos campos.");
  return resultado;
}
function texto(valor: unknown, nombre: string, maximo: number) {
  if (typeof valor !== "string" || !valor.trim() || valor.trim().length > maximo) throw error(`Revisa el campo ${nombre}.`);
  return valor.trim();
}
function claveActual(valor: unknown): string {
  if (typeof valor !== "string" || !valor || Buffer.byteLength(valor, "utf8") > 72) throw error("Escribe tu contraseña actual.");
  return valor;
}
async function cuenta(id: string) {
  const usuario = await prisma.usuarios.findUnique({ where: { id } });
  if (!usuario?.activo || !usuario.correo_verificado_en) throw error("La cuenta ya no está habilitada.", 401);
  return usuario;
}
async function comprobarClave(id: string, valor: unknown) {
  const clave = claveActual(valor);
  const usuario = await cuenta(id);
  if (!await bcrypt.compare(clave, usuario.password_hash)) throw error("La contraseña actual no es correcta.", 403);
  return usuario;
}

// Mismo bloqueo de usuario que login y recuperación. Revalida la sesión dentro
// de la transacción para impedir cambios desde una sesión revocada en paralelo.
async function bloquear(tx: Prisma.TransactionClient, id: string, token: unknown) {
  await tx.$queryRaw`SELECT id FROM rutaec.usuarios WHERE id = ${id}::uuid FOR UPDATE`;
  const usuario = await tx.usuarios.findUnique({ where: { id } });
  if (!usuario?.activo || !usuario.correo_verificado_en || typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) throw error("Debes iniciar sesión nuevamente.", 401);
  const sesion = await tx.tokens_acceso.findFirst({ where: {
    usuario_id: id, proposito: "REFRESH", token_hash: createHash("sha256").update(token).digest("hex"),
    revocado_en: null, consumido_en: null, vence_en: { gt: new Date() },
  } });
  if (!sesion) throw error("Tu sesión terminó. Ingresa nuevamente.", 401);
  return usuario;
}
function comprobarSinCambios(actual: { password_hash: string; correo: string }, anterior: { password_hash: string; correo: string }) {
  if (actual.password_hash !== anterior.password_hash || actual.correo !== anterior.correo) throw error("La cuenta cambió durante la operación. Vuelve a intentarlo.", 409);
}
async function revocarPendientes(tx: Prisma.TransactionClient, id: string) {
  await tx.tokens_acceso.updateMany({
    where: { usuario_id: id, revocado_en: null, consumido_en: null },
    data: { revocado_en: new Date() },
  });
}

export async function obtenerPerfil(id: string) {
  const usuario = await prisma.usuarios.findUnique({ where: { id }, select: camposPerfil });
  if (!usuario) throw error("No se encontró la cuenta.", 404);
  return usuario;
}

export async function actualizarPerfil(id: string, token: unknown, entrada: unknown) {
  const d = datos(entrada, ["nombres", "apellidos", "telefono"]);
  const nombres = texto(d.nombres, "nombres", 100);
  const apellidos = texto(d.apellidos, "apellidos", 100);
  const telefono = texto(d.telefono, "teléfono", 10);
  if (!/^09\d{8}$/.test(telefono)) throw error("El celular debe tener 10 dígitos y comenzar con 09.");
  return prisma.$transaction(async tx => {
    await bloquear(tx, id, token);
    return tx.usuarios.update({ where: { id }, data: { nombres, apellidos, telefono, actualizado_en: new Date() }, select: camposPerfil });
  });
}

export async function cambiarClavePerfil(id: string, token: unknown, entrada: unknown) {
  const d = datos(entrada, ["claveActual", "nuevaClave", "confirmarClave"]);
  if (typeof d.nuevaClave !== "string" || d.nuevaClave.length < 8 || Buffer.byteLength(d.nuevaClave, "utf8") > 72) throw error("La contraseña debe tener al menos 8 caracteres y hasta 72 bytes.");
  if (d.nuevaClave !== d.confirmarClave) throw error("Las contraseñas no coinciden.");
  const anterior = await comprobarClave(id, d.claveActual);
  const hash = await bcrypt.hash(d.nuevaClave, 12);
  await prisma.$transaction(async tx => {
    const actual = await bloquear(tx, id, token);
    comprobarSinCambios(actual, anterior);
    await tx.usuarios.update({ where: { id }, data: { password_hash: hash, actualizado_en: new Date() } });
    await revocarPendientes(tx, id);
    await tx.$queryRaw`SELECT rutaec.encolar_evento('CUENTA_CLAVE_CAMBIADA', ${id}::uuid, NULL::uuid, ${`clave-perfil:${id}:${randomInt(0, 2147483647)}`})`;
  });
  return { mensaje: "Contraseña actualizada. Inicia sesión nuevamente." };
}

export async function solicitarCorreoPerfil(id: string, token: unknown, entrada: unknown) {
  const d = datos(entrada, ["nuevoCorreo", "claveActual"]);
  const nuevoCorreo = texto(d.nuevoCorreo, "nuevo correo", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nuevoCorreo)) throw error("Escribe un correo válido.");
  const anterior = await comprobarClave(id, d.claveActual);
  if (anterior.correo.toLowerCase() === nuevoCorreo) throw error("Escribe un correo diferente del actual.");
  const codigo = randomInt(0, 1000000).toString().padStart(6, "0");
  const codigoHash = await bcrypt.hash(codigo, 12);
  const registro = await prisma.$transaction(async tx => {
    const actual = await bloquear(tx, id, token);
    comprobarSinCambios(actual, anterior);
    const ultimo = await tx.tokens_acceso.findFirst({ where: { usuario_id: id, proposito: "CAMBIAR_CORREO" }, orderBy: { creado_en: "desc" } });
    if (ultimo && Date.now() - ultimo.creado_en.getTime() < 60000) throw error("Espera un minuto antes de pedir otro código.", 429);
    if (await tx.usuarios.findFirst({ where: { correo: { equals: nuevoCorreo, mode: "insensitive" }, NOT: { id } }, select: { id: true } })) throw error("No se puede utilizar ese correo.", 409);
    await tx.tokens_acceso.updateMany({ where: { usuario_id: id, proposito: "CAMBIAR_CORREO", consumido_en: null, revocado_en: null }, data: { revocado_en: new Date() } });
    return tx.tokens_acceso.create({ data: { usuario_id: id, proposito: "CAMBIAR_CORREO", nuevo_correo: nuevoCorreo, token_hash: codigoHash, vence_en: new Date(Date.now() + 15 * 60000) }, select: { id: true, vence_en: true } });
  });
  try {
    await enviarCodigoCambioCorreo(nuevoCorreo, codigo);
  } catch {
    await prisma.tokens_acceso.updateMany({ where: { id: registro.id, consumido_en: null, revocado_en: null }, data: { revocado_en: new Date() } });
    throw error("No se pudo enviar el código. Tu correo actual no cambió; vuelve a solicitarlo en un minuto.", 503);
  }
  return { mensaje: "Código enviado al nuevo correo. El correo actual sigue vigente hasta confirmar.", verificacionId: registro.id, venceEn: registro.vence_en.toISOString() };
}

export async function confirmarCorreoPerfil(id: string, token: unknown, entrada: unknown) {
  const d = datos(entrada, ["verificacionId", "codigo"]);
  if (typeof d.verificacionId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(d.verificacionId) || typeof d.codigo !== "string" || !/^\d{6}$/.test(d.codigo)) throw error("Introduce el código de seis dígitos de la solicitud.");
  const { verificacionId, codigo } = d;
  try {
    await prisma.$transaction(async tx => {
      const anterior = await bloquear(tx, id, token);
      const ahora = new Date();
      const registro = await tx.tokens_acceso.findFirst({ where: { id: verificacionId, usuario_id: id, proposito: "CAMBIAR_CORREO", consumido_en: null, revocado_en: null, vence_en: { gt: ahora } } });
      if (!registro?.nuevo_correo || !await bcrypt.compare(codigo, registro.token_hash)) throw error("El código es incorrecto, venció o ya fue utilizado.");
      const consumido = await tx.tokens_acceso.updateMany({ where: { id: registro.id, usuario_id: id, proposito: "CAMBIAR_CORREO", consumido_en: null, revocado_en: null, vence_en: { gt: ahora } }, data: { consumido_en: ahora } });
      if (consumido.count !== 1) throw error("El código venció o ya fue utilizado.");
      await tx.usuarios.update({ where: { id }, data: { correo: registro.nuevo_correo, correo_verificado_en: ahora, actualizado_en: ahora } });
      await revocarPendientes(tx, id);
      await tx.$queryRaw`SELECT rutaec.encolar_evento('CUENTA_CORREO_CAMBIADO', ${id}::uuid, NULL::uuid, ${`correo-perfil:${registro.id}`}, ${JSON.stringify({ correo_anterior: anterior.correo })}::jsonb)`;
    });
  } catch (e) {
    if (typeof e === "object" && e !== null && "code" in e && e.code === "P2002") throw error("No se puede utilizar ese correo. Solicita un código para otro.", 409);
    throw e;
  }
  return { mensaje: "Correo actualizado. Inicia sesión con tu nuevo correo." };
}
