import { addDays, diffDays, hoy, parse } from './fechas'

export const DESCUENTOS = {
  ninguno: { nombre: 'Sin descuento', pct: 0 },
  menor: { nombre: 'Menor de edad', pct: 0.5 },
  tercera: { nombre: 'Tercera edad', pct: 0.5 },
  discapacidad: { nombre: 'Discapacidad', pct: 0.5 },
}

export function finHoja(hoja) {
  return addDays(hoja.inicio, hoja.dias - 1)
}

export function layoutAsientos(tipo) {
  const out = []
  const letras = tipo === 'chiva' ? ['A', 'B', 'C'] : ['A', 'B', 'C', 'D']
  const push = (piso, filas, vipHasta) => {
    for (let f = 1; f <= filas; f++) {
      letras.forEach((l) => {
        out.push({ id: `${piso}-${f}${l}`, piso, fila: f, letra: l, label: `${f}${l}`, tipo: f <= vipHasta ? 'vip' : 'normal' })
      })
    }
  }
  if (tipo === 'dospisos') {
    push(1, 3, 3)
    push(2, 9, 0)
  } else if (tipo === 'chiva') {
    push(1, 8, 0)
  } else {
    push(1, 10, 3)
  }
  return out
}

function semilla(texto) {
  let h = 2166136261
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

// Mezcla la ocupación simulada de cada viaje con los asientos realmente vendidos (los que informa el servidor).
export function asientosOcupados(viajeId, asientos, ocupacion) {
  const rnd = semilla(viajeId)
  const ocup = new Set()
  asientos.forEach((a) => {
    if (rnd() < 0.34) ocup.add(a.id)
  })
  ;(ocupacion[viajeId] || []).forEach((a) => ocup.add(a))
  return ocup
}

export function precioTramo(f, origen, destino) {
  const i = f.paradas.indexOf(origen)
  const j = f.paradas.indexOf(destino)
  const frac = (j - i) / (f.paradas.length - 1)
  return Math.max(1.5, Math.round(f.precio * frac * 4) / 4)
}

export function precioFinal(base, tipoAsiento, descuento) {
  const conAsiento = tipoAsiento === 'vip' ? base * 1.3 : base
  const pct = DESCUENTOS[descuento].pct
  return Math.round(conAsiento * (1 - pct) * 100) / 100
}

export function totalCompra(pasajeros, base) {
  let total = pasajeros.reduce((s, p) => s + precioFinal(base, p.tipoAsiento, p.descuento), 0)
  const terceras = pasajeros.filter((p) => p.descuento === 'tercera')
  terceras.forEach((p) => {
    total -= precioFinal(base, p.tipoAsiento, 'ninguno') * 0.5 * 0.5
  })
  return Math.round(total * 100) / 100
}

export function cedulaValida(c) {
  if (!/^\d+$/.test(c) || c.length < 9) return false
  if (c.length !== 10) return true
  const prov = Number(c.slice(0, 2))
  if (prov < 1 || prov > 24) return false
  const d = c.split('').map(Number)
  let suma = 0
  for (let i = 0; i < 9; i++) {
    let v = d[i] * (i % 2 === 0 ? 2 : 1)
    if (v > 9) v -= 9
    suma += v
  }
  return (10 - (suma % 10)) % 10 === d[9]
}

export function busDeViaje(hoja, buses, freqId, fecha) {
  const d = diffDays(hoja.inicio, fecha)
  const id = Object.keys(hoja.celdas).find((busId) => hoja.celdas[busId][d] === freqId)
  return buses.find((b) => b.id === id) || null
}

export function buscarViajes({ frecuencias, hojas, buses, ocupacion, origen, destino, fecha }) {
  const resultado = []
  frecuencias.forEach((f) => {
    const i = f.paradas.indexOf(origen)
    const j = f.paradas.indexOf(destino)
    if (i < 0 || j <= i) return
    if (f.tipo === 'directa' && !(i === 0 && j === f.paradas.length - 1)) return
    if (!f.diasVenta.includes(parse(fecha).getDay())) return
    const hoja = hojas[f.coopId]
    const bus = busDeViaje(hoja, buses, f.id, fecha)
    if (!bus) return
    const viajeId = `${f.id}_${fecha}`
    const asientos = layoutAsientos(bus.tipo)
    const ocup = asientosOcupados(viajeId, asientos, ocupacion)
    resultado.push({
      id: viajeId,
      f,
      bus,
      fecha,
      origen,
      destino,
      precio: precioTramo(f, origen, destino),
      libres: asientos.length - ocup.size + 1,
    })
  })
  return resultado.sort((a, b) => a.f.hora.localeCompare(b.f.hora))
}

export function estadoRango(frecuencias, hojas, destinoFecha, origen, destino) {
  const hojasUsadas = frecuencias.filter((f) => f.paradas.includes(origen) && f.paradas.includes(destino))
  if (!hojasUsadas.length) return 'sin-ruta'
  if (destinoFecha < hoy()) return 'pasado'
  const maxFin = hojasUsadas.map((f) => finHoja(hojas[f.coopId])).sort().pop()
  if (destinoFecha > maxFin) return { fuera: maxFin }
  return 'ok'
}
