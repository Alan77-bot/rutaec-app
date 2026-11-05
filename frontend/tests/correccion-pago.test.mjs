import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'

let states, cursor, effects, mounted, requests
globalThis.pagoHooks = {
  useState(initial) {
    const i = cursor++
    if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial
    return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value }]
  },
  useRef(value) { const i = cursor++; return states[i] ??= { current: value } },
  useEffect(effect) { if (!mounted) effects.push(effect) },
}
const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, plugins: [
  { name: 'pago-test', enforce: 'pre',
    transform(code, id) {
      if (id.endsWith('/PresentarPago.jsx')) return code.replace("from 'react'", "from 'virtual:pago-hooks'").replace("from 'react-router-dom'", "from 'virtual:pago-router'")
    },
    resolveId(id) { if (id.startsWith('virtual:pago-')) return '\0' + id },
    load(id) {
      if (id === '\0virtual:pago-hooks') return 'export const {useState,useRef,useEffect} = globalThis.pagoHooks;'
      if (id === '\0virtual:pago-router') return "export const Link = 'a'; export const useParams = () => ({compraId:'compra-prueba'}); export const useNavigate = () => () => {};"
    },
  }, react(),
] })
const { default: PresentarPago } = await server.ssrLoadModule('/src/modules/pagos/PresentarPago.jsx')
const fetchOriginal = globalThis.fetch
after(async () => { globalThis.fetch = fetchOriginal; await server.close() })
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree?.props ? [tree, ...nodes(tree.props.children)] : []
const text = tree => Array.isArray(tree) ? tree.map(text).join('') : tree?.props ? text(tree.props.children) : typeof tree === 'string' ? tree : ''
function render() { cursor = 0; return PresentarPago() }
async function setup(correccion, cuentas = []) {
  states = []; cursor = 0; effects = []; mounted = false; requests = []
  const info = { ventanilla: true, cuentas, pagos: correccion ? [{id:'pago-original',estado:'CORRECCION',motivo:'Archivo ilegible'}] : [], tarjeta:{habilitada:false}, compra:{total:10,moneda:'USD',estado:'RESERVADA',vence_en:'2099-01-01T00:00:00Z'} }
  globalThis.fetch = async (url, init = {}) => {
    requests.push({url, init})
    if (url.includes('/cuentas/')) return Response.json({datos:info})
    return Response.json({datos:[]})
  }
  render(); mounted = true
  for (const effect of effects) effect()
  for (let i=0;i<5;i++) await new Promise(resolve => setImmediate(resolve))
}

test('corregir un pago de ventanilla muestra archivo y envía al pago original, sin otro cobro', async () => {
  await setup(true)
  let all = nodes(render())
  assert.ok(!text(render()).includes('Efectivo recibido'))
  assert.ok(!text(render()).includes('Confirmar venta al registrar'))
  assert.ok(all.some(n => n.type === 'input' && n.props.type === 'file'))
  const boton = all.find(n => n.type === 'button' && text(n) === 'Enviar corrección para revisión')
  assert.equal(boton.props.disabled, false, 'la corrección no depende de nuevas cuentas activas')
  all.find(n => n.type === 'input' && n.props.type === 'file').props.onChange({target:{files:[new File(['prueba'],'comprobante.png',{type:'image/png'})]}})
  await nodes(render()).find(n => n.type === 'form').props.onSubmit({preventDefault(){}})
  const posts = requests.filter(r => r.init.method === 'POST')
  assert.equal(posts.length, 1)
  assert.equal(posts[0].url, '/api/pagos/revisiones/pagos/pago-original/corregir')
  assert.equal(posts[0].init.body.get('confirmado'), null)
  assert.equal(posts[0].init.body.get('archivo').name, 'comprobante.png')
})

test('una venta nueva en ventanilla conserva efectivo y exige confirmación', async () => {
  await setup(false)
  const all = nodes(render())
  assert.ok(text(render()).includes('Efectivo recibido'))
  assert.ok(!all.some(n => n.type === 'input' && n.props.type === 'file'))
  const boton = all.find(n => n.type === 'button' && text(n) === 'Confirmar pago y generar documentos')
  assert.equal(boton.props.disabled, true)
})
