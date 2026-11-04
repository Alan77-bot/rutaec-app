import { addDays, hoy } from './fechas'

export const TIPOS_BUS = {
  normal: { nombre: 'Bus normal', asientos: 40 },
  dospisos: { nombre: 'Bus de 2 pisos', asientos: 48 },
  chiva: { nombre: 'Chiva turística', asientos: 24 },
}

const MARCAS_CHASIS = ['Hino', 'Volkswagen', 'Mercedes-Benz', 'Scania']
const MARCAS_CARROCERIA = ['Busscar', 'Marcopolo', 'Picasso', 'Varma']

export const COOPERATIVAS = [
  { id: 'amazonas', nombre: 'Amazonas', color: '#1d3f8f', ciudad: 'Ambato', ruc: '1890012345001', activa: true, logo: '/img/logos/amazonas.jpg', fotos: { normal: '/img/buses/amazonas.jpg', dospisos: '/img/buses/amazonas-2p.jpg' } },
  { id: 'santa', nombre: 'Santa', color: '#b5483a', ciudad: 'Ambato', ruc: '1890023456001', activa: true, logo: '/img/logos/santa.jpg', fotos: { normal: '/img/buses/santa.jpg', dospisos: '/img/buses/santa-2p.jpg' } },
  { id: 'ambato', nombre: 'Ambato', color: '#c63a32', ciudad: 'Ambato', ruc: '1890034567001', activa: true, logo: '/img/logos/ambato.jpg', fotos: { normal: '/img/buses/ambato.jpg' } },
  { id: 'pelileo', nombre: 'Flota Pelileo', color: '#1f5fa8', ciudad: 'Pelileo', ruc: '1890045678001', activa: true, logo: '/img/logos/pelileo.jpg', fotos: { normal: '/img/buses/pelileo.png' } },
  { id: 'termchivas', nombre: 'Terminal Turístico de Chivas', color: '#d9822b', ciudad: 'Baños', ruc: '1890056789001', activa: true, turismo: true, logo: '/img/logos/chivas.jpg', fotos: { chiva: '/img/chiva.jpg' } },
]

const FOTOS_GENERICAS = { normal: '/img/bus-normal.jpg', dospisos: '/img/bus-dospisos.jpg', chiva: '/img/chiva.jpg' }

// Foto del bus según la cooperativa y el tipo; si no hay una propia usa la genérica.
export const fotoBus = (coop, tipo) => coop?.fotos?.[tipo] || FOTOS_GENERICAS[tipo]

const flotas = {
  amazonas: { base: 40, tipos: ['dospisos', 'dospisos', 'normal', 'normal', 'normal', 'normal'] },
  santa: { base: 10, tipos: ['dospisos', 'dospisos', 'normal', 'normal', 'normal'] },
  ambato: { base: 21, tipos: ['normal', 'normal', 'normal', 'normal', 'normal'] },
  pelileo: { base: 5, tipos: ['normal', 'normal', 'normal', 'normal'] },
  termchivas: { base: 1, tipos: ['chiva', 'chiva', 'chiva', 'chiva', 'chiva'] },
}

export const BUSES_INICIALES = Object.entries(flotas).flatMap(([coopId, f], c) =>
  f.tipos.map((tipo, i) => ({
    id: `${coopId}-${f.base + i}`,
    coopId,
    numero: f.base + i,
    tipo,
    placa: `T${'BACDEFG'[(c + i) % 7]}${'AKLMNPRS'[(i * 3 + c) % 8]}-${String(1180 + c * 213 + i * 37).padStart(4, '0')}`,
    chasis: MARCAS_CHASIS[(c + i) % 4],
    carroceria: MARCAS_CARROCERIA[(c * 2 + i) % 4],
  }))
)

const ida = (a) => a
const vuelta = (a) => [...a].reverse()

const R_AMB_LOJA = ['Ambato', 'Riobamba', 'Cuenca', 'Loja']
const R_QUI_LOJA = ['Quito', 'Latacunga', 'Ambato', 'Riobamba', 'Cuenca', 'Loja']
const R_AMB_QUI = ['Ambato', 'Latacunga', 'Quito']
const R_PEL_QUI = ['Pelileo', 'Ambato', 'Latacunga', 'Quito']

const TODOS = [0, 1, 2, 3, 4, 5, 6]

export const FRECUENCIAS_INICIALES = [
  { id: 'f1', coopId: 'amazonas', hora: '19:00', resolucion: 'ANT-2021-0412', tipo: 'compartida', paradas: ida(R_AMB_LOJA), precio: 14, duracion: '9 h', diasVenta: TODOS, activa: true },
  { id: 'f2', coopId: 'amazonas', hora: '22:00', resolucion: 'ANT-2021-0413', tipo: 'compartida', paradas: vuelta(R_AMB_LOJA), precio: 14, duracion: '9 h', diasVenta: TODOS, activa: true },
  { id: 'f3', coopId: 'amazonas', hora: '10:00', resolucion: 'ANT-2022-0188', tipo: 'directa', paradas: ['Ambato', 'Guayaquil'], precio: 8.5, duracion: '4 h 30', diasVenta: TODOS, activa: true },
  { id: 'f4', coopId: 'amazonas', hora: '11:00', resolucion: 'ANT-2022-0189', tipo: 'directa', paradas: ['Guayaquil', 'Ambato'], precio: 8.5, duracion: '4 h 30', diasVenta: TODOS, activa: true },

  { id: 'f5', coopId: 'santa', hora: '20:00', resolucion: 'ANT-2020-0931', tipo: 'compartida', paradas: ida(R_QUI_LOJA), precio: 18, duracion: '13 h', diasVenta: TODOS, activa: true },
  { id: 'f6', coopId: 'santa', hora: '20:30', resolucion: 'ANT-2020-0932', tipo: 'compartida', paradas: vuelta(R_QUI_LOJA), precio: 18, duracion: '13 h', diasVenta: TODOS, activa: true },
  { id: 'f7', coopId: 'santa', hora: '08:00', resolucion: 'ANT-2023-0077', tipo: 'directa', paradas: ['Quito', 'Cuenca'], precio: 13, duracion: '9 h 30', diasVenta: [1, 3, 5, 6], activa: true },

  { id: 'f8', coopId: 'ambato', hora: '07:00', resolucion: 'ANT-2019-0554', tipo: 'compartida', paradas: ida(R_AMB_QUI), precio: 4.5, duracion: '2 h 30', diasVenta: TODOS, activa: true },
  { id: 'f9', coopId: 'ambato', hora: '14:00', resolucion: 'ANT-2019-0555', tipo: 'compartida', paradas: vuelta(R_AMB_QUI), precio: 4.5, duracion: '2 h 30', diasVenta: TODOS, activa: true },
  { id: 'f10', coopId: 'ambato', hora: '09:00', resolucion: 'ANT-2024-0102', tipo: 'directa', paradas: ['Ambato', 'Baños'], precio: 1.75, duracion: '45 min', diasVenta: TODOS, activa: false },

  { id: 'f11', coopId: 'pelileo', hora: '06:30', resolucion: 'ANT-2018-0210', tipo: 'directa', paradas: ['Pelileo', 'Ambato'], precio: 1, duracion: '35 min', diasVenta: TODOS, activa: true },
  { id: 'f12', coopId: 'pelileo', hora: '17:30', resolucion: 'ANT-2018-0211', tipo: 'directa', paradas: ['Ambato', 'Pelileo'], precio: 1, duracion: '35 min', diasVenta: TODOS, activa: true },
  { id: 't1', coopId: 'termchivas', hora: '10:00', resolucion: 'MINTUR-2023-0345', tipo: 'tour', ciudad: 'Baños', paradas: ['Baños', 'Ruta de las Cascadas'], precio: 6, duracion: '3 h', diasVenta: TODOS, activa: true, titulo: 'Ruta de las Cascadas', detalle: 'Río Verde, Pailón del Diablo y mirador, con paradas para fotos.' },
  { id: 't2', coopId: 'termchivas', hora: '18:00', resolucion: 'MINTUR-2023-0346', tipo: 'tour', ciudad: 'Guayaquil', paradas: ['Guayaquil', 'Malecón 2000 y Las Peñas'], precio: 5, duracion: '2 h 30', diasVenta: TODOS, activa: true, titulo: 'Guayaquil, Perla del Pacífico', detalle: 'Malecón 2000, Las Peñas y el cerro Santa Ana al atardecer.' },
  { id: 't3', coopId: 'termchivas', hora: '16:00', resolucion: 'MINTUR-2023-0347', tipo: 'tour', ciudad: 'Quito', paradas: ['Quito', 'Centro Histórico y Panecillo'], precio: 8, duracion: '3 h', diasVenta: TODOS, activa: true, titulo: 'Chiva quiteña', detalle: 'Centro Histórico, plazas coloniales y mirador del Panecillo.' },
  { id: 't4', coopId: 'termchivas', hora: '15:00', resolucion: 'MINTUR-2023-0348', tipo: 'tour', ciudad: 'Cuenca', paradas: ['Cuenca', 'Mirador de Turi'], precio: 7, duracion: '2 h', diasVenta: TODOS, activa: true, titulo: 'City tour Cuenca', detalle: 'Catedral, barrio San Sebastián y vista desde Turi.' },
  { id: 'f13', coopId: 'pelileo', hora: '05:00', resolucion: 'ANT-2018-0212', tipo: 'compartida', paradas: ida(R_PEL_QUI), precio: 5.5, duracion: '3 h', diasVenta: [0, 6], activa: true },
]

export const CIUDADES = [...new Set(FRECUENCIAS_INICIALES.filter((f) => f.tipo !== 'tour').flatMap((f) => f.paradas))].sort()

// Rotación de la hoja de ruta: el bus i en el día d toma la posición (i + d) mod N.
// Si la posición cae dentro de las frecuencias activas trabaja, si no es día de parada.
export function generarHoja(buses, frecuencias, inicio, dias) {
  const N = buses.length
  const activas = frecuencias.filter((f) => f.activa)
  const celdas = {}
  buses.forEach((b, i) => {
    celdas[b.id] = Array.from({ length: dias }, (_, d) => {
      const pos = (i + d) % N
      return pos < activas.length ? activas[pos].id : null
    })
  })
  return { inicio, dias, celdas }
}

export function hojasIniciales() {
  const inicio = addDays(hoy(), -1)
  const out = {}
  COOPERATIVAS.forEach((c) => {
    const buses = BUSES_INICIALES.filter((b) => b.coopId === c.id)
    const frecs = FRECUENCIAS_INICIALES.filter((f) => f.coopId === c.id)
    out[c.id] = generarHoja(buses, frecs, inicio, 30)
  })
  return out
}
