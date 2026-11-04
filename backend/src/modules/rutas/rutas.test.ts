import assert from 'node:assert/strict';
import { afterEach, it } from 'node:test';
import { prisma } from '../../lib/prisma.js';
import { actualizarRuta, crearRuta, listarRutas } from './rutas.service.js';

const A = '550e8400-e29b-41d4-a716-446655440000';
const B = '550e8400-e29b-41d4-a716-446655440001';
const ORIGEN = '550e8400-e29b-41d4-a716-446655440002';
const DESTINO = '550e8400-e29b-41d4-a716-446655440003';
const restaurar: (() => void)[] = [];
function sustituir(objeto: unknown, metodo: string, funcion: unknown) {
  const destino = objeto as Record<string, unknown>, original = destino[metodo];
  destino[metodo] = funcion; restaurar.push(() => { destino[metodo] = original; });
}
afterEach(() => { restaurar.splice(0).reverse().forEach(f => f()); });

it('solo el gerente con cooperativa puede crear o modificar rutas', async () => {
  for (const actor of [undefined, { rol: 'admin', coopId: null }, { rol: 'oficinista', coopId: A }, { rol: 'usuario', coopId: null }, { rol: 'cooperativa', coopId: null }]) {
    await assert.rejects(crearRuta({}, actor), { estado: 403 });
    await assert.rejects(actualizarRuta(A, {}, actor), { estado: 403 });
  }
});
it('la ruta se crea en la cooperativa de la sesión y guarda las paradas en orden', async () => {
  let guardado: Record<string, unknown> | undefined;
  sustituir(prisma.cooperativas, 'findUnique', async ({ where }: { where: { id: string } }) => { assert.equal(where.id, A); return { id: A }; });
  sustituir(prisma.terminales, 'findMany', async () => [{ id: ORIGEN, ciudad_id: A }, { id: DESTINO, ciudad_id: B }]);
  sustituir(prisma.rutas, 'findFirst', async () => null);
  sustituir(prisma.rutas, 'create', async ({ data }: { data: Record<string, unknown> }) => { guardado = data; return { id: A }; });
  sustituir(prisma.rutas, 'findMany', async () => [{ id: A, cooperativa_id: A, cooperativas: { nombre_comercial: 'Cooperativa A' }, nombre: 'Ambato - Quito', version: 1, activa: true, paradas_ruta: [] }]);
  const resultado = await crearRuta({ cooperativa_id: B, nombre: 'Ambato - Quito', paradas: [{ terminal_id: ORIGEN, minutos_desde_origen: 0 }, { terminal_id: DESTINO, minutos_desde_origen: 120 }] }, { rol: 'cooperativa', coopId: A });
  assert.equal(guardado?.cooperativa_id, A);
  assert.equal(resultado?.cooperativa_id, A);
  const paradas = (guardado?.paradas_ruta as { create: { orden: number; minutos_desde_origen: number }[] }).create;
  assert.deepEqual(paradas.map(p => [p.orden, p.minutos_desde_origen]), [[1, 0], [2, 120]]);
});
it('el gerente no puede modificar una ruta de otra cooperativa', async () => {
  sustituir(prisma.rutas, 'findUnique', async () => ({ id: ORIGEN, cooperativa_id: B }));
  await assert.rejects(actualizarRuta(ORIGEN, { activa: false }, { rol: 'cooperativa', coopId: A }), { estado: 403 });
});
it('el listado del gerente se filtra en la consulta de base de datos', async () => {
  sustituir(prisma.rutas, 'findMany', async ({ where }: { where: { cooperativa_id: string } }) => { assert.equal(where.cooperativa_id, A); return []; });
  assert.deepEqual(await listarRutas(undefined, A), []);
});
it('rechaza tiempos de parada que no aumentan desde el origen', async () => {
  sustituir(prisma.cooperativas, 'findUnique', async () => ({ id: A }));
  await assert.rejects(crearRuta({ nombre: 'Ruta inválida', paradas: [{ terminal_id: ORIGEN, minutos_desde_origen: 0 }, { terminal_id: DESTINO, minutos_desde_origen: 0 }] }, { rol: 'cooperativa', coopId: A }), { estado: 400 });
});
