import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import bcrypt from 'bcryptjs';

// Las sustituciones se registran antes de importar los servicios reales.
// No se carga Prisma, dotenv ni SMTP; bcrypt sí se ejecuta realmente.
let guardado;
const usuario = {
  id: 'usuario-prueba', activo: true, correo_verificado_en: new Date(),
  nombres: 'Ana', apellidos: 'Prueba', correo: 'ana@example.invalid',
  roles_globales: [{ rol: 'CLIENTE' }], miembros_cooperativa: [],
};
const prisma = {
  usuarios: {
    findFirst: async () => null,
    findUnique: async () => usuario,
    create: async ({ data }) => { guardado = data.password_hash; return { id: usuario.id }; },
    update: async ({ data }) => { guardado = data.password_hash; },
  },
  tokens_acceso: {
    create: async () => ({ id: 'token-prueba' }),
    findUnique: async () => ({ id: 'token-prueba', usuario_id: usuario.id, proposito: 'RECUPERAR_CLAVE', vence_en: new Date(Date.now() + 900000) }),
    updateMany: async () => ({ count: 1 }),
  },
  $queryRaw: async () => [],
  $transaction: async callback => callback(prisma),
};
globalThis.prismaPruebaClaves = prisma;
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.endsWith('/lib/prisma.js')) return { url: 'mock:prisma-claves', shortCircuit: true };
    if (specifier === './correo.service.js' || specifier === './recuperacion.correo.service.js') return { url: 'mock:correo-claves', shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'mock:prisma-claves') return { format: 'module', source: 'export const prisma = globalThis.prismaPruebaClaves;', shortCircuit: true };
    if (url === 'mock:correo-claves') return { format: 'module', source: 'export async function enviarCodigoVerificacion() {} export async function enviarEnlaceRecuperacion() {}', shortCircuit: true };
    return next(url, context);
  },
});
const { registrarUsuario } = await import('../dist/modules/usuarios/registro.service.js');
const { restablecerContrasena } = await import('../dist/modules/usuarios/recuperacion.service.js');
const { autenticar } = await import('../dist/modules/usuarios/usuarios.service.js');
beforeEach(() => { guardado = undefined; });
const registrar = clave => registrarUsuario({ nombres: 'Ana', apellidos: 'Prueba', correo: usuario.correo, numero_documento: '0102030405', telefono: '0991234567', clave });
const restablecer = (clave, confirmarClave = clave) => restablecerContrasena({ token: 'a'.repeat(64), nuevaClave: clave, confirmarClave });

for (const [nombre, ejecutar] of [['registro', registrar], ['recuperación', restablecer]]) {
  test(`${nombre}: rechaza siete caracteres y valores no string`, async () => {
    for (const clave of ['Ab1!xyz', 12345678, null]) {
      await assert.rejects(ejecutar(clave), { estado: 400 });
      assert.equal(guardado, undefined);
    }
  });
  test(`${nombre}: acepta ocho caracteres con letras, números y símbolos y guarda bcrypt`, async () => {
    await ejecutar('Ab1!xyZ?');
    assert.ok(await bcrypt.compare('Ab1!xyZ?', guardado));
  });
  test(`${nombre}: acepta exactamente 72 bytes UTF-8`, async () => {
    const clave = 'é'.repeat(36);
    await ejecutar(clave);
    assert.ok(await bcrypt.compare(clave, guardado));
  });
  test(`${nombre}: rechaza más de 72 bytes UTF-8`, async () => {
    await assert.rejects(ejecutar('é'.repeat(37)), { estado: 400 });
    assert.equal(guardado, undefined);
  });
}
test('recuperación: sigue exigiendo confirmación idéntica', async () => {
  await assert.rejects(restablecer('Ab1!xyZ?', 'Ab1!xyZ!'), { estado: 400 });
  assert.equal(guardado, undefined);
});
test('login: conserva acceso con contraseñas existentes de más de doce caracteres', async () => {
  const clave = 'Clave-existente-2026!';
  usuario.password_hash = await bcrypt.hash(clave, 4);
  prisma.usuarios.findFirst = async () => usuario;
  try {
    const respuesta = await autenticar(usuario.correo, clave);
    assert.equal(respuesta.sesion.id, usuario.id);
  } finally {
    prisma.usuarios.findFirst = async () => null;
  }
});
