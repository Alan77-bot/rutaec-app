import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { cooperativaVisible, esPersonal, inicioPorRol } from '../src/data/acceso.js'

const A = '550e8400-e29b-41d4-a716-446655440000'
const B = '550e8400-e29b-41d4-a716-446655440001'

test('cada rol tiene su inicio y solo clientes/visitantes utilizan el portal público', () => {
  for (const [rol, ruta] of [['admin', '/admin'], ['cooperativa', '/cooperativa'], ['oficinista', '/oficinista']]) {
    assert.equal(inicioPorRol(rol), ruta); assert.equal(esPersonal(rol), true)
  }
  assert.equal(inicioPorRol('usuario'), '/'); assert.equal(esPersonal('usuario'), false)
  assert.equal(esPersonal(undefined), false)
})
test('la selección pública no modifica la identidad del personal', () => {
  assert.equal(cooperativaVisible({ rol: 'admin' }, A), null)
  for (const rol of ['cooperativa', 'oficinista']) assert.equal(cooperativaVisible({ rol, coopId: A }, B), A)
  assert.equal(cooperativaVisible({ rol: 'usuario' }, B), B)
  assert.equal(cooperativaVisible(null, A), A)
  assert.equal(cooperativaVisible(null, 'todas'), null)
  assert.equal(cooperativaVisible(null, '../otra'), null)
})

globalThis.pruebaApp = { config: { nombre: 'RutaEC', redes: {}, soporteTel: '', soporteMail: '' }, sesion: null }
globalThis.pruebaIdentidad = { cooperativa: null, cooperativaId: null }
const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, plugins: [
  { name: 'identidad-test', enforce: 'pre',
    transform(code, id) {
      if (id.endsWith('/Footer.jsx') || id.endsWith('/Home.jsx')) return code
        .replace(/from ['"]\.\.\/context\/AppContext['"]/, "from 'virtual:identidad-app'")
        .replace(/from ['"]\.\.\/context\/PersonalizacionContext['"]/, "from 'virtual:identidad-coop'")
    },
    resolveId(id) { if (id.startsWith('virtual:identidad-')) return '\0' + id },
    load(id) {
      if (id === '\0virtual:identidad-app') return 'export const useApp = () => globalThis.pruebaApp;'
      if (id === '\0virtual:identidad-coop') return 'export const usePersonalizacion = () => globalThis.pruebaIdentidad;'
    },
  }, react(),
] })
after(() => server.close())
const { default: Footer } = await server.ssrLoadModule('/src/components/Footer.jsx')
const { default: Home } = await server.ssrLoadModule('/src/pages/Home.jsx')

test('el pie muestra los contactos y enlaces oficiales de la cooperativa', () => {
  globalThis.pruebaIdentidad = { cooperativaId: A, cooperativa: { nombre: 'Cooperativa A', telefono: '0991234567', correo: 'contacto@a.example', direccion: 'Terminal Ambato', redes_sociales: { instagram: 'https://instagram.com/coop-a', facebook: 'javascript:alert(1)', whatsapp: '+593991234567' } } }
  const html = renderToStaticMarkup(React.createElement(Footer))
  for (const texto of ['Cooperativa A', 'Terminal Ambato', 'contacto@a.example', 'https://instagram.com/coop-a', 'https://wa.me/593991234567']) assert.ok(html.includes(texto))
  assert.ok(!html.includes('javascript:'))
  assert.ok(!html.includes('RutaEC'))
})
test('al volver a todas las cooperativas el pie recupera la marca general', () => {
  globalThis.pruebaIdentidad = { cooperativa: null, cooperativaId: null }
  const html = renderToStaticMarkup(React.createElement(Footer))
  assert.ok(html.includes('RutaEC')); assert.ok(!html.includes('contacto@a.example'))
})
test('el espacio de una cooperativa usa su portada y oculta la promoción para empresas', () => {
  globalThis.pruebaIdentidad = { cooperativaId: A, cooperativa: { nombre: 'Cooperativa A', fotografia: '/foto-a.png' } }
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Home)))
  assert.ok(html.includes('/foto-a.png')); assert.ok(html.includes('Cooperativa A'))
  assert.ok(!html.includes('¿Tienes una cooperativa'))
  globalThis.pruebaIdentidad = { cooperativa: null, cooperativaId: null }
  const general = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Home)))
  assert.ok(general.includes('¿Tienes una cooperativa'))
})
