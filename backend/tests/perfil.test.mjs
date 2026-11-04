import { beforeEach, test } from 'node:test';
import { createHash } from 'node:crypto';
import express from 'express';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import bcrypt from 'bcryptjs';

// El cliente de base y SMTP se sustituyen antes de cargar cualquier servicio.
// Ninguna prueba usa .env, PostgreSQL ni cuentas/correos reales.
let user, records, sent, failedMail, duplicate, consumeCount, sessionValid, changedWhileHashing;
const initialHash = await bcrypt.hash('Actual-123!', 4);
const token = 'a'.repeat(64);
const id = '00000000-0000-4000-8000-000000000001';
const codeId = '00000000-0000-4000-8000-000000000002';
function matches(row, where) {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'vence_en') return row.vence_en > value.gt;
    return row[key] === value;
  });
}
const tx = {
  $queryRaw: async (sql) => {
    assert.match(sql.join(''), /FOR UPDATE/);
    if (changedWhileHashing) user.password_hash = 'cambiado-en-paralelo';
  },
  usuarios: {
    findUnique: async ({ select }) => select
      ? Object.fromEntries(Object.keys(select).map(key => [key, user[key]])) : { ...user },
    findFirst: async () => duplicate ? { id: 'otra-cuenta' } : null,
    update: async ({ where, data, select }) => {
      assert.equal(where.id, id);
      if (data.correo && duplicate) throw Object.assign(new Error('unique'), { code: 'P2002' });
      Object.assign(user, data);
      return select ? Object.fromEntries(Object.keys(select).map(key => [key, user[key]])) : { ...user };
    },
  },
  tokens_acceso: {
    findUnique: async ({ where }) => records.find(row => row.token_hash === where.token_hash) ?? null,
    findFirst: async ({ where, orderBy }) => {
      if (where.proposito === 'REFRESH') return sessionValid ? { id: 'session' } : null;
      const found = records.filter(row => matches(row, where));
      return orderBy ? found.at(-1) ?? null : found[0] ?? null;
    },
    create: async ({ data }) => { const row = { ...data, id: codeId, creado_en: new Date(), revocado_en: null, consumido_en: null }; records.push(row); return row; },
    updateMany: async ({ where, data }) => {
      if (data.consumido_en && consumeCount !== 1) return { count: consumeCount };
      let count = 0;
      for (const row of records) if (matches(row, where)) { Object.assign(row, data); count++; }
      return { count };
    },
  },
};
const prisma = { ...tx, $transaction: async callback => {
  const originalUser = structuredClone(user), originalRecords = structuredClone(records);
  try { return await callback(tx); }
  catch (e) { user = originalUser; records = originalRecords; throw e; }
} };
globalThis.perfilMockPrisma = prisma;
globalThis.perfilMockEnviar = async (correo, codigo) => { if (failedMail) throw new Error('SMTP prueba'); sent = { correo, codigo }; };
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.endsWith('/lib/prisma.js')) return { url: 'mock:perfil-prisma', shortCircuit: true };
    if (specifier === './perfil.correo.js') return { url: 'mock:perfil-correo', shortCircuit: true };
    if (specifier === 'dotenv/config') return { url: 'mock:sin-entorno', shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'mock:perfil-prisma') return { format: 'module', shortCircuit: true, source: 'export const prisma=globalThis.perfilMockPrisma;' };
    if (url === 'mock:perfil-correo') return { format: 'module', shortCircuit: true, source: 'export const enviarCodigoCambioCorreo=(...args)=>globalThis.perfilMockEnviar(...args);' };
    if (url === 'mock:sin-entorno') return { format: 'module', shortCircuit: true, source: '' };
    return next(url, context);
  },
});
const service = await import('../dist/modules/usuarios/perfil.service.js');
beforeEach(() => {
  user = { id, nombres: 'Ana', apellidos: 'Prueba', telefono: '0991234567', correo: 'ana@example.invalid', tipo_documento: 'CEDULA', pais_documento: 'EC', numero_documento: '0102030405', password_hash: initialHash, activo: true, correo_verificado_en: new Date(), roles_globales: [{ rol: 'CLIENTE' }], miembros_cooperativa: [] };
  records = [{ id: 'session', usuario_id: id, token_hash: createHash('sha256').update(token).digest('hex'), proposito: 'REFRESH', consumido_en: null, revocado_en: null, vence_en: new Date(Date.now() + 3600000) }];
  sent = undefined; failedMail = duplicate = changedWhileHashing = false;
  consumeCount = 1; sessionValid = true;
});
const changePassword = overrides => service.cambiarClavePerfil(id, token, { claveActual: 'Actual-123!', nuevaClave: 'Nueva-8!', confirmarClave: 'Nueva-8!', ...overrides });
const requestEmail = overrides => service.solicitarCorreoPerfil(id, token, { nuevoCorreo: 'nuevo@example.invalid', claveActual: 'Actual-123!', ...overrides });
const confirmEmail = overrides => service.confirmarCorreoPerfil(id, token, { verificacionId: codeId, codigo: sent?.codigo, ...overrides });

test('consulta únicamente datos de perfil, sin hashes ni privilegios', async () => {
  const profile = await service.obtenerPerfil(id);
  assert.equal(profile.id, id);
  assert.equal(profile.password_hash, undefined);
  assert.equal(profile.roles_globales, undefined);
});
test('edita nombres, apellidos y teléfono del usuario de sesión', async () => {
  const profile = await service.actualizarPerfil(id, token, { nombres: ' Ana María ', apellidos: ' Test ', telefono: '0997654321' });
  assert.equal(profile.nombres, 'Ana María');
  assert.equal(profile.telefono, '0997654321');
  assert.equal(profile.correo, 'ana@example.invalid');
});
test('rechaza edición de rol, cooperativa, correo y documento', async () => {
  for (const key of ['rol', 'coopId', 'correo', 'numero_documento', 'id']) await assert.rejects(service.actualizarPerfil(id, token, { nombres: 'Ana', apellidos: 'Test', telefono: '0991234567', [key]: 'inyectado' }), { estado: 400 });
});
test('valida nombres y celular en servidor', async () => {
  for (const patch of [{ nombres: ' ' }, { telefono: '123' }, { apellidos: 'x'.repeat(101) }]) await assert.rejects(service.actualizarPerfil(id, token, { nombres: 'Ana', apellidos: 'Test', telefono: '0991234567', ...patch }), { estado: 400 });
});
test('una sesión revocada durante la operación impide editar', async () => {
  sessionValid = false;
  await assert.rejects(service.actualizarPerfil(id, token, { nombres: 'Cambio', apellidos: 'Test', telefono: '0991234567' }), { estado: 401 });
  assert.equal(user.nombres, 'Ana');
});
test('cambia contraseña de ocho caracteres con bcrypt y revoca sesiones', async () => {
  await changePassword();
  assert.ok(await bcrypt.compare('Nueva-8!', user.password_hash));
  assert.ok(records[0].revocado_en instanceof Date);
});
test('rechaza contraseña actual incorrecta', async () => {
  await assert.rejects(changePassword({ claveActual: 'incorrecta' }), { estado: 403 });
  assert.equal(user.password_hash, initialHash);
});
test('rechaza clave menor de ocho, mayor de 72 bytes o confirmación diferente', async () => {
  for (const patch of [{ nuevaClave: 'siete77' }, { nuevaClave: 'é'.repeat(37) }, { confirmarClave: 'distinta' }, { nuevaClave: 12345678 }]) await assert.rejects(changePassword(patch), { estado: 400 });
  assert.equal(user.password_hash, initialHash);
});
test('acepta contraseña de exactamente 72 bytes', async () => {
  const clave = 'é'.repeat(36);
  await changePassword({ nuevaClave: clave, confirmarClave: clave });
  assert.ok(await bcrypt.compare(clave, user.password_hash));
});
test('impide sobrescribir contraseña cambiada en paralelo', async () => {
  changedWhileHashing = true;
  await assert.rejects(changePassword(), { estado: 409 });
});
test('solicitud manda código al nuevo correo y no cambia el anterior', async () => {
  const response = await requestEmail();
  assert.equal(user.correo, 'ana@example.invalid');
  assert.equal(sent.correo, 'nuevo@example.invalid');
  assert.match(sent.codigo, /^\d{6}$/);
  const record = records.at(-1);
  assert.ok(await bcrypt.compare(sent.codigo, record.token_hash));
  assert.notEqual(record.token_hash, sent.codigo);
  assert.ok(new Date(response.venceEn).getTime() > Date.now() + 14 * 60000);
});
test('confirmación consume código, reemplaza correo y revoca sesiones', async () => {
  await requestEmail();
  await confirmEmail();
  assert.equal(user.correo, 'nuevo@example.invalid');
  assert.ok(records.at(-1).consumido_en);
  assert.ok(records[0].revocado_en);
  await assert.rejects(confirmEmail(), { estado: 400 });
});
test('código incorrecto o vencido no cambia el correo', async () => {
  await requestEmail();
  await assert.rejects(confirmEmail({ codigo: 'invalido' }), { estado: 400 });
  const incorrecto = sent.codigo === '000000' ? '111111' : '000000';
  await assert.rejects(confirmEmail({ codigo: incorrecto }), { estado: 400 });
  records.at(-1).vence_en = new Date(0);
  await assert.rejects(confirmEmail(), { estado: 400 });
  assert.equal(user.correo, 'ana@example.invalid');
});
test('código de otro propietario no se puede confirmar', async () => {
  await requestEmail();
  records.at(-1).usuario_id = 'otro-usuario';
  await assert.rejects(confirmEmail(), { estado: 400 });
  assert.equal(user.correo, 'ana@example.invalid');
});
test('consumo atómico rechazado impide cambiar el correo', async () => {
  await requestEmail(); consumeCount = 0;
  await assert.rejects(confirmEmail(), { estado: 400 });
  assert.equal(user.correo, 'ana@example.invalid');
});
test('reenvío exige un minuto e invalida el código anterior', async () => {
  await requestEmail();
  await assert.rejects(requestEmail(), { estado: 429 });
  records.at(-1).creado_en = new Date(Date.now() - 61000);
  const previous = records.at(-1);
  await requestEmail();
  assert.ok(previous.revocado_en);
});
test('fallo SMTP revoca código y conserva correo anterior', async () => {
  failedMail = true;
  await assert.rejects(requestEmail(), { estado: 503 });
  assert.ok(records.at(-1).revocado_en);
  assert.equal(user.correo, 'ana@example.invalid');
});
test('rechaza nuevo correo inválido, idéntico o ya ocupado', async () => {
  await assert.rejects(requestEmail({ nuevoCorreo: 'no-es-correo' }), { estado: 400 });
  await assert.rejects(requestEmail({ nuevoCorreo: user.correo }), { estado: 400 });
  duplicate = true;
  await assert.rejects(requestEmail(), { estado: 409 });
});
test('conflicto único al confirmar no consume código ni cambia correo', async () => {
  await requestEmail(); duplicate = true;
  await assert.rejects(confirmEmail(), { estado: 409 });
  assert.equal(user.correo, 'ana@example.invalid');
  assert.equal(records.at(-1).consumido_en, null);
});

test('API real: sesión, origen, edición y límites de intentos de código', async () => {
  const { default: router } = await import('../dist/modules/usuarios/usuarios.routes.js');
  const app = express();
  app.use(express.json()); app.use('/api/usuarios', router);
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const url = `http://127.0.0.1:${server.address().port}/api/usuarios/perfil`;
  const headers = { Cookie: `rutaec_sesion=${token}`, Origin: 'http://localhost:5173', 'Content-Type': 'application/json' };
  try {
    assert.equal((await fetch(url)).status, 401);
    const response = await fetch(url, { headers });
    assert.equal(response.status, 200);
    const profile = (await response.json()).perfil;
    assert.equal(profile.password_hash, undefined);
    assert.equal(profile.correo, user.correo);
    assert.equal((await fetch(url, { method: 'PATCH', headers: { ...headers, Origin: 'https://otro.invalid' }, body: '{}' })).status, 403);
    assert.equal((await fetch(url, { method: 'PATCH', headers, body: JSON.stringify({ nombres: 'Ana', apellidos: 'Test', telefono: '0991234567', rol: 'admin' }) })).status, 400);
    const saved = await fetch(url, { method: 'PATCH', headers, body: JSON.stringify({ nombres: 'Editado', apellidos: 'Test', telefono: '0991234567' }) });
    assert.equal(saved.status, 200);
    assert.equal((await saved.json()).perfil.nombres, 'Editado');
    for (let attempt = 0; attempt < 5; attempt++) assert.equal((await fetch(`${url}/correo/confirmar`, { method: 'POST', headers, body: '{}' })).status, 400);
    assert.equal((await fetch(`${url}/correo/confirmar`, { method: 'POST', headers, body: '{}' })).status, 429);
  } finally {
    await new Promise((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
  }
});
