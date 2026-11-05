import { test } from 'node:test'
import assert from 'node:assert/strict'
import { horaLlegada } from '../src/modules/horarios/horaLlegada.js'
import { generarAsientos } from '../src/modules/cooperativas/asientos.distribucion.js'
test('calcula llegada usando minutos acumulados, sin sumarlos dos veces',()=>{
  assert.equal(horaLlegada('08:00',[{minutos_desde_origen:0},{minutos_desde_origen:50},{minutos_desde_origen:140}]),'10:20')
  assert.equal(horaLlegada('23:00',[{minutos_desde_origen:150}]),'01:30 (+1 día)')
  assert.equal(horaLlegada('',[]),'')
})
test('distribuye asientos entre dos pisos, incluidos totales impares',()=>{
  const configs=[1,2].map(piso=>({piso,filas:6,columnas:5,pasillo:3,espacios:[]}))
  const asientos=generarAsientos(23,configs)
  assert.equal(asientos.length,23)
  assert.equal(asientos.filter(a=>a.piso===1).length,12)
  assert.equal(asientos.filter(a=>a.piso===2).length,11)
  assert.equal(new Set(asientos.map(a=>a.numero)).size,23)
  assert.ok(asientos.every(a=>a.columna!==3))
})
test('la generación respeta escaleras y posiciones especiales',()=>{
  const asientos=generarAsientos(8,[{piso:1,filas:4,columnas:5,pasillo:3,espacios:[{fila:1,columna:1,tipo:'ESCALERA'}]}])
  assert.equal(asientos.length,8)
  assert.ok(!asientos.some(a=>a.fila===1&&a.columna===1))
})
