import assert from 'node:assert/strict';
import { it } from 'node:test';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

it('API de personalización: guarda, recarga, sirve imágenes y aísla cooperativas', async () => {
  const directorio = await mkdtemp(path.join(tmpdir(), 'rutaec-personalizacion-'));
  process.env.PERSONALIZACION_DIR = directorio;
  const { prisma } = await import('../../lib/prisma.js');
  const { default: app } = await import('../../app.js');
  const id = '550e8400-e29b-41d4-a716-446655440000';
  const otra = '550e8400-e29b-41d4-a716-446655440001';
  const usuario = '550e8400-e29b-41d4-a716-446655440002';
  let rol = 'GERENTE';
  let cooperativa = { id, nombre_comercial: 'Prueba A', color_primario: '#16324F', color_secundario: '#FFFFFF', correo: 'a@example.com', telefono: '0999999999', direccion: 'Ambato', sitio_web: null, redes_sociales: {}, logo_archivo_id: null } as Record<string, unknown>;
  const archivos: Record<string, unknown>[] = [];
  const restaurar: (() => void)[] = [];
  function sustituir(objeto: unknown, metodo: string, funcion: unknown) {
    const destino = objeto as Record<string, unknown>;
    const original = destino[metodo];
    destino[metodo] = funcion;
    restaurar.push(() => { destino[metodo] = original; });
  }
  // Se sustituye solo la persistencia: las rutas, sesión, permisos, validación y disco son reales.
  sustituir(prisma.tokens_acceso, 'findUnique', async () => ({ proposito: 'REFRESH', usuario_id: usuario, vence_en: new Date(Date.now() + 60000) }) as never);
  sustituir(prisma.usuarios, 'findUnique', async () => ({ id: usuario, nombres: 'Gerente', apellidos: 'Prueba', activo: true, correo_verificado_en: new Date(), roles_globales: [], miembros_cooperativa: [{ rol, cooperativa_id: id }] }) as never);
  sustituir(prisma.cooperativas, 'findUnique', async () => cooperativa as never);
  sustituir(prisma.cooperativas, 'findUniqueOrThrow', async () => cooperativa as never);
  sustituir(prisma.cooperativas, 'update', async (args: { data: Record<string, unknown> }) => { cooperativa = { ...cooperativa, ...args.data }; return cooperativa as never; });
  sustituir(prisma.archivos, 'create', async (args: { data: Record<string, unknown> }) => { archivos.push(args.data); return args.data as never; });
  sustituir(prisma.archivos, 'findFirst', async (args: { where: { id: string; cooperativa_id: string } }) => archivos.find(a => a.id === args.where.id && a.cooperativa_id === args.where.cooperativa_id) as never);
  sustituir(prisma, '$queryRaw', async () => [] as never);
  sustituir(prisma, '$transaction', async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma) as never);
  const servidor = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => servidor.once('listening', resolve));
  const base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/api/cooperativas`;
  const cookie = `rutaec_sesion=${'a'.repeat(64)}`;
  async function guardar(destino: string, datos: unknown, autenticar = true) {
    return fetch(`${base}/${destino}/personalizacion`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(autenticar ? { Cookie: cookie } : {}) }, body: JSON.stringify(datos) });
  }
  try {
    assert.equal((await guardar(id, { color_primario: '#123456' }, false)).status, 401);
    assert.equal((await guardar(otra, { color_primario: '#123456' })).status, 403);
    rol = 'OFICINISTA';
    assert.equal((await guardar(id, { color_primario: '#123456' })).status, 403);
    rol = 'GERENTE';
    assert.equal((await guardar(id, { nombre_comercial: 'Cambiar nombre' })).status, 400);
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
    // Supera el límite JSON global de 100 KB para comprobar el parser de esta ruta.
    const portada = 'data:image/png;base64,' + Buffer.concat([Buffer.from(png.split(',')[1]!, 'base64'), Buffer.alloc(150000)]).toString('base64');
    const respuesta = await guardar(id, { color_primario: '#123456', logo: png, fotografia: portada, facebook: 'https://facebook.com/prueba' });
    assert.equal(respuesta.status, 200, await respuesta.clone().text());
    const guardado = (await respuesta.json()).datos;
    assert.equal(guardado.color_primario, '#123456');
    assert.ok(guardado.logo.startsWith(`/api/cooperativas/${id}/`));
    assert.ok(guardado.fotografia.startsWith(`/api/cooperativas/${id}/`));
    const recarga = await fetch(`${base}/${id}/personalizacion`);
    assert.equal((await recarga.json()).datos.logo, guardado.logo);
    const origen = new URL(base).origin;
    const imagen = await fetch(origen + guardado.logo);
    assert.equal(imagen.status, 200); assert.equal(imagen.headers.get('content-type'), 'image/png');
    assert.ok(Buffer.from(await imagen.arrayBuffer()).equals(Buffer.from(png.split(',')[1]!, 'base64')));
    assert.equal((await fetch(origen + guardado.logo.replace(id, otra))).status, 404);
    // Conservar URLs no duplica archivos y quitar imágenes persiste.
    assert.equal((await guardar(id, { logo: guardado.logo, fotografia: guardado.fotografia })).status, 200);
    assert.equal((await readdir(directorio)).length, 2);
    assert.equal((await guardar(id, { logo: '', fotografia: '' })).status, 200);
    const quitado = (await (await fetch(`${base}/${id}/personalizacion`)).json()).datos;
    assert.equal(quitado.logo, ''); assert.equal(quitado.fotografia, '');
    assert.equal(quitado.redes_sociales.facebook, 'https://facebook.com/prueba');
  } finally {
    await new Promise<void>((resolve, reject) => servidor.close(e => e ? reject(e) : resolve()));
    restaurar.reverse().forEach(f => f());
    await prisma.$disconnect();
    // Solo se elimina el directorio temporal creado para esta prueba.
    assert.ok(directorio.startsWith(path.join(tmpdir(), 'rutaec-personalizacion-')));
    await rm(directorio, { recursive: true, force: true });
  }
});
