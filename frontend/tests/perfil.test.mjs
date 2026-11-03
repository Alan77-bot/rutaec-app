import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

// Ejecuta los handlers del componente real y el cliente HTTP con fetch simulado.
// Solo los hooks/contexto/navegación se sustituyen para inspeccionar los estados.
let states, cursor, effects, mounted, app, requests, navigation, failUpdate;
globalThis.perfilHooks = {
  useState(initial) {
    const slot = cursor++;
    if (!(slot in states)) states[slot] = typeof initial === 'function' ? initial() : initial;
    return [states[slot], value => { states[slot] = typeof value === 'function' ? value(states[slot]) : value; }];
  },
  useEffect(effect) { if (!mounted) effects.push(effect); },
};
globalThis.perfilNavigate = (...args) => { navigation = args; };
globalThis.perfilContext = () => app;
const server = await createServer({ configFile: false, server: { middlewareMode: true }, plugins: [
  { name: 'perfil-test', enforce: 'pre',
    transform(code, id) {
      if (id.endsWith('/usuarios/Perfil.jsx')) return code.replace("from 'react'", "from 'virtual:perfil-hooks'").replace("from 'react-router-dom'", "from 'virtual:perfil-router'").replace("from '../../context/AppContext'", "from 'virtual:perfil-context'");
    },
    resolveId(id) { if (id.startsWith('virtual:perfil-')) return '\0' + id; },
    load(id) {
      if (id === '\0virtual:perfil-hooks') return 'export const {useState,useEffect} = globalThis.perfilHooks;';
      if (id === '\0virtual:perfil-router') return 'export const useNavigate = () => globalThis.perfilNavigate;';
      if (id === '\0virtual:perfil-context') return 'export const useApp = () => globalThis.perfilContext();';
    },
  }, react(),
] });
after(() => server.close());
const { default: Perfil } = await server.ssrLoadModule('/src/modules/usuarios/Perfil.jsx');
const originalFetch = globalThis.fetch;
after(() => { globalThis.fetch = originalFetch; });
const profile = { id: 'test', nombres: 'Ana', apellidos: 'Prueba', telefono: '0991234567', correo: 'ana@example.invalid', tipo_documento: 'CEDULA', pais_documento: 'EC', numero_documento: '0102030405' };
function render() { cursor = 0; return Perfil(); }
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object' || !tree.props) return [];
  return [tree, ...nodes(tree.props.children)];
}
function content(tree) {
  if (Array.isArray(tree)) return tree.map(content).join('');
  if (tree === null || tree === undefined || typeof tree === 'boolean') return '';
  if (typeof tree !== 'object') return String(tree);
  return content(tree.props?.children);
}
function input(label) {
  const node = nodes(render()).find(n => n.type === 'label' && content(n).startsWith(label));
  assert.ok(node, `campo ${label}`);
  return nodes(node).find(n => n.type === 'input');
}
function type(label, value) { input(label).props.onChange({ target: { value } }); }
async function submit(index) { await nodes(render()).filter(n => n.type === 'form')[index].props.onSubmit({ preventDefault() {} }); }
async function setup() {
  states = []; cursor = 0; effects = []; mounted = false; requests = []; navigation = undefined; failUpdate = false;
  app = { sesion: { id: 'test', nombre: 'Ana Prueba' }, setSesion(value) { app.sesion = typeof value === 'function' ? value(app.sesion) : value; }, reintentar: async () => {}, avisar() {} };
  globalThis.fetch = async (url, init) => {
    requests.push({ url, init });
    const data = init.body ? JSON.parse(init.body) : undefined;
    if (init.method === 'GET') return Response.json({ perfil: profile });
    if (failUpdate) return Response.json({ error: 'Fallo de prueba' }, { status: 503 });
    if (init.method === 'PATCH') return Response.json({ perfil: { ...profile, ...data } });
    if (url.endsWith('/correo')) return Response.json({ mensaje: 'Código enviado', verificacionId: 'code-test', venceEn: new Date(Date.now() + 900000).toISOString() });
    return Response.json({ mensaje: 'Cambio completado' });
  };
  render(); mounted = true;
  for (const effect of effects) effect();
  await new Promise(resolve => setImmediate(resolve));
}

test('carga perfil real, muestra documento sin campo editable y usa cookies', async () => {
  await setup();
  assert.match(content(render()), /0102030405/);
  assert.equal(input('Nombres').props.value, 'Ana');
  assert.equal(requests[0].init.credentials, 'include');
  assert.equal(nodes(render()).some(n => n.type === 'input' && n.props.value === profile.numero_documento), false);
});
test('edición envía solo nombres, apellidos y celular y actualiza el menú', async () => {
  await setup(); type('Nombres', 'Editado'); await submit(0);
  const request = requests.at(-1);
  assert.equal(request.init.method, 'PATCH');
  assert.deepEqual(JSON.parse(request.init.body), { nombres: 'Editado', apellidos: 'Prueba', telefono: '0991234567' });
  assert.equal(app.sesion.nombre, 'Editado Prueba');
  assert.match(content(render()), /Tus datos fueron guardados/);
});
test('error de servidor mantiene datos editados y muestra el error', async () => {
  await setup(); type('Nombres', 'Sin perder'); failUpdate = true; await submit(0);
  assert.equal(input('Nombres').props.value, 'Sin perder');
  assert.match(content(render()), /Fallo de prueba/);
});
test('clave de siete caracteres o confirmación distinta no llama a API', async () => {
  await setup(); type('Nueva contraseña', 'siete77'); type('Confirmar nueva', 'siete77'); await submit(1);
  assert.equal(requests.length, 1);
  type('Nueva contraseña', 'Nueva-8!'); type('Confirmar nueva', 'distinta'); await submit(1);
  assert.equal(requests.length, 1);
  assert.match(content(render()), /no coinciden/);
});
test('cambio de clave envía clave actual y vuelve al login', async () => {
  await setup(); type('Contraseña actual', 'Anterior!'); type('Nueva contraseña', 'Nueva-8!'); type('Confirmar nueva', 'Nueva-8!'); await submit(1);
  assert.deepEqual(JSON.parse(requests.at(-1).init.body), { claveActual: 'Anterior!', nuevaClave: 'Nueva-8!', confirmarClave: 'Nueva-8!' });
  assert.equal(app.sesion, null);
  assert.equal(navigation[0], '/ingresar');
});
test('correo conserva el anterior hasta confirmar y usa el identificador recibido', async () => {
  await setup(); type('Nuevo correo', 'nuevo@example.invalid');
  const passwords = nodes(render()).filter(n => n.type === 'input' && n.props.autoComplete === 'current-password');
  passwords.at(-1).props.onChange({ target: { value: 'Anterior!' } });
  await submit(2);
  assert.match(content(render()), /ana@example.invalid/);
  assert.match(content(render()), /Código enviado a nuevo@example.invalid/);
  assert.equal(navigation, undefined);
  type('Código de seis dígitos', '123456'); await submit(3);
  assert.deepEqual(JSON.parse(requests.at(-1).init.body), { verificacionId: 'code-test', codigo: '123456' });
  assert.equal(navigation[0], '/ingresar');
});
