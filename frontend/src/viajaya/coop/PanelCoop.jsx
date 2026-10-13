import { useMemo, useState } from 'react'
import { useApp } from '../ui/AppContext'
import BusArt from '../ui/BusArt'
import { TIPOS_BUS, generarHoja } from '../data/mock'
import { addDays, DIAS, fechaCorta, hoy, parse } from '../data/fechas'
import { finHoja } from '../data/viajes'

const PALETA = ['#1d3f8f', '#b5483a', '#2f8a5b', '#8a5a9e', '#c98a1b', '#2f5d9e']

function TabBuses({ coop, misBuses }) {
  const { acciones, ejecutar } = useApp()
  const [form, setForm] = useState({ numero: '', placa: '', tipo: 'normal', chasis: 'Hino', carroceria: 'Marcopolo' })

  const agregar = async (e) => {
    e.preventDefault()
    const r = await ejecutar(
      () => acciones.crearBus({ coopId: coop.id, ...form, numero: Number(form.numero), placa: form.placa.trim().toUpperCase() }),
      'Bus agregado a la flota.'
    )
    if (r.ok) setForm({ ...form, numero: '', placa: '' })
  }
  const quitar = (id) => ejecutar(() => acciones.quitarBus(id), 'Bus eliminado.')

  return (
    <div className="dos-col">
      <div className="grilla-buses">
        {misBuses.map((b) => (
          <article key={b.id} className="bus-card">
            <BusArt tipo={b.tipo} color={coop.color} />
            <div>
              <b>N.º {b.numero} · {b.placa}</b>
              <small>{TIPOS_BUS[b.tipo].nombre} · {b.chasis} / {b.carroceria}</small>
            </div>
            <button className="btn-link rojo" onClick={() => quitar(b.id)}>Quitar</button>
          </article>
        ))}
        {misBuses.length === 0 && <div className="vacio"><b>Aún no registras buses.</b></div>}
      </div>
      <form className="panel" onSubmit={agregar}>
        <h4>Nuevo bus</h4>
        <label>Número<input value={form.numero} inputMode="numeric" onChange={(e) => setForm({ ...form, numero: e.target.value })} /></label>
        <label>Placa<input placeholder="TBA-1234" value={form.placa} onChange={(e) => setForm({ ...form, placa: e.target.value })} /></label>
        <label>Grupo
          <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
            {Object.entries(TIPOS_BUS).map(([k, t]) => <option key={k} value={k}>{t.nombre}</option>)}
          </select>
        </label>
        <label>Chasis
          <select value={form.chasis} onChange={(e) => setForm({ ...form, chasis: e.target.value })}>
            {['Hino', 'Volkswagen', 'Mercedes-Benz', 'Scania'].map((m) => <option key={m}>{m}</option>)}
          </select>
        </label>
        <label>Carrocería
          <select value={form.carroceria} onChange={(e) => setForm({ ...form, carroceria: e.target.value })}>
            {['Busscar', 'Marcopolo', 'Picasso', 'Varma'].map((m) => <option key={m}>{m}</option>)}
          </select>
        </label>
        <button className="btn btn-oscuro">Agregar bus</button>
      </form>
    </div>
  )
}

function TabFrecuencias({ coop, misFrecs }) {
  const { acciones, ejecutar, ciudades } = useApp()
  const [nueva, setNueva] = useState({ origen: 'Ambato', destino: 'Quito', hora: '08:00', resolucion: '', tipo: 'directa', precio: 5, dias: [0, 1, 2, 3, 4, 5, 6] })

  const alternar = (f) => ejecutar(() => acciones.actualizarFrecuencia(f.id, { activa: !f.activa }))
  const dia = (f, d) => {
    const dias = f.diasVenta.includes(d) ? f.diasVenta.filter((x) => x !== d) : [...f.diasVenta, d].sort()
    return ejecutar(() => acciones.actualizarFrecuencia(f.id, { diasVenta: dias }))
  }

  const crear = async (e) => {
    e.preventDefault()
    if (nueva.origen === nueva.destino) return ejecutar(async () => { throw new Error('El origen y el destino no pueden ser iguales.') })
    const r = await ejecutar(
      () => acciones.crearFrecuencia({
        coopId: coop.id, hora: nueva.hora, resolucion: nueva.resolucion, tipo: nueva.tipo,
        paradas: [nueva.origen, nueva.destino], precio: Number(nueva.precio), diasVenta: nueva.dias,
      }),
      'Frecuencia registrada.'
    )
    if (r.ok) setNueva({ ...nueva, resolucion: '' })
  }

  return (
    <>
      <div className="tabla-wrap">
        <table className="tabla">
          <thead>
            <tr><th>Ruta</th><th>Hora</th><th>Resolución ANT</th><th>Tipo</th><th>Días de venta</th><th>Precio</th><th>Estado</th></tr>
          </thead>
          <tbody>
            {misFrecs.map((f) => (
              <tr key={f.id} className={f.activa ? '' : 'inactiva'}>
                <td><b>{f.paradas[0]} → {f.paradas.at(-1)}</b>{f.tipo === 'compartida' && <small>vía {f.paradas.slice(1, -1).join(', ')}</small>}</td>
                <td>{f.hora}</td>
                <td>{f.resolucion}</td>
                <td><span className={'badge ' + (f.tipo === 'directa' ? 'verde' : f.tipo === 'tour' ? 'gris' : 'ambar')}>{f.tipo === 'directa' ? 'Directa' : f.tipo === 'tour' ? 'Tour' : 'Con paradas'}</span></td>
                <td>
                  <div className="dias">
                    {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                      <button key={d} className={f.diasVenta.includes(d) ? 'on' : ''} onClick={() => dia(f, d)}>{DIAS[d][0]}</button>
                    ))}
                  </div>
                </td>
                <td>${f.precio.toFixed(2)}</td>
                <td>
                  <button className={'switch' + (f.activa ? ' on' : '')} onClick={() => alternar(f)} aria-label="Activar o desactivar"><i /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form className="panel form-freq" onSubmit={crear}>
        <h4>Nueva frecuencia asignada por la ANT</h4>
        <div className="form-fila">
          <label>Origen<select value={nueva.origen} onChange={(e) => setNueva({ ...nueva, origen: e.target.value })}>{ciudades.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label>Destino<select value={nueva.destino} onChange={(e) => setNueva({ ...nueva, destino: e.target.value })}>{ciudades.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label>Hora<input type="time" value={nueva.hora} onChange={(e) => setNueva({ ...nueva, hora: e.target.value })} /></label>
          <label>N.º de resolución<input placeholder="ANT-2026-0001" value={nueva.resolucion} onChange={(e) => setNueva({ ...nueva, resolucion: e.target.value })} /></label>
          <label>Tipo<select value={nueva.tipo} onChange={(e) => setNueva({ ...nueva, tipo: e.target.value })}><option value="directa">Directa</option><option value="compartida">Con paradas</option></select></label>
          <label>Precio<input type="number" step="0.25" value={nueva.precio} onChange={(e) => setNueva({ ...nueva, precio: e.target.value })} /></label>
        </div>
        <button className="btn btn-oscuro">Registrar frecuencia</button>
      </form>
    </>
  )
}

function TabHoja({ coop, misBuses, misFrecs }) {
  const { hojas, acciones, ejecutar, avisar } = useApp()
  const hoja = hojas[coop.id]
  // La hoja se edita como borrador y solo se guarda cuando el usuario lo pide.
  const [borrador, setBorrador] = useState(null)
  const actual = borrador || hoja
  const [inicio, setInicio] = useState(hoja.inicio)
  const [dias, setDias] = useState(Math.min(hoja.dias, 14))
  const activas = misFrecs.filter((f) => f.activa)
  const colorDe = (id) => PALETA[activas.findIndex((f) => f.id === id) % PALETA.length]
  const mostrar = Math.min(actual.dias, 14)

  const conflictos = useMemo(() => {
    let n = 0
    for (let d = 0; d < actual.dias; d++) {
      const usadas = Object.values(actual.celdas).map((f) => f[d]).filter(Boolean)
      n += usadas.length - new Set(usadas).size
    }
    return n
  }, [actual])

  const generar = () => {
    if (misBuses.length <= activas.length) avisar('Ojo: no queda ningún bus libre para días de parada.')
    setBorrador(generarHoja(misBuses, misFrecs, inicio, Number(dias)))
  }
  const ciclar = (busId, d) => {
    const opciones = [...activas.map((f) => f.id), null]
    const celdas = { ...actual.celdas }
    const act = celdas[busId][d]
    const sig = opciones[(opciones.indexOf(act) + 1) % opciones.length]
    celdas[busId] = celdas[busId].map((x, k) => (k === d ? sig : x))
    setBorrador({ ...actual, celdas })
  }
  const guardar = async () => {
    const r = await ejecutar(() => acciones.guardarHoja(coop.id, { inicio: actual.inicio, dias: actual.dias, celdas: actual.celdas }), 'Hoja de ruta guardada. Ya está disponible para la venta.')
    if (r.ok) setBorrador(null)
  }
  const nombre = (id) => {
    const f = misFrecs.find((x) => x.id === id)
    return f ? `${f.paradas[0].slice(0, 3)}-${f.paradas.at(-1).slice(0, 3)} ${f.hora}` : ''
  }

  return (
    <>
      <div className="panel hoja-ctrl">
        <div>
          <b>{misBuses.length} buses · {activas.length} frecuencias activas</b>
          <p className="muted">{misBuses.length - activas.length > 0 ? `${misBuses.length - activas.length} bus(es) en parada cada día.` : 'Sin buses de reserva.'} Venta abierta hasta el {fechaCorta(finHoja(hoja))}.</p>
        </div>
        <label>Válida desde<input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></label>
        <label>Días<input type="number" min="7" max="60" value={dias} onChange={(e) => setDias(e.target.value)} /></label>
        <button className="btn btn-claro" onClick={generar}>Generar automática</button>
      </div>

      {(borrador || conflictos > 0) && (
        <div className={'aviso-hoja' + (conflictos > 0 ? ' mal' : '')}>
          {conflictos > 0
            ? `Hay ${conflictos} día(s) con una frecuencia asignada a dos buses. Corrígelo antes de guardar.`
            : 'Tienes cambios sin guardar. Los clientes verán la nueva hoja cuando la guardes.'}
          <span>
            <button className="btn btn-claro" onClick={() => setBorrador(null)}>Descartar</button>
            <button className="btn btn-acento" onClick={guardar} disabled={conflictos > 0}>Guardar hoja</button>
          </span>
        </div>
      )}

      <div className="tabla-wrap">
        <table className="hoja">
          <thead>
            <tr>
              <th>Bus</th>
              {Array.from({ length: mostrar }, (_, d) => (
                <th key={d} className={addDays(actual.inicio, d) === hoy() ? 'hoy' : ''}>
                  <small>{DIAS[parse(addDays(actual.inicio, d)).getDay()]}</small>
                  {parse(addDays(actual.inicio, d)).getDate()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {misBuses.map((b) => (
              <tr key={b.id}>
                <th>N.º {b.numero}</th>
                {(actual.celdas[b.id] || []).slice(0, mostrar).map((fid, d) => (
                  <td key={d}>
                    <button className={'celda-h' + (fid ? '' : ' parada')} style={fid ? { background: colorDe(fid) } : null} onClick={() => ciclar(b.id, d)} title={fid ? nombre(fid) : 'Día de parada'}>
                      {fid ? nombre(fid).split(' ')[0] : 'P'}
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="leyenda-h">
        {activas.map((f) => <span key={f.id}><i style={{ background: colorDe(f.id) }} />{f.paradas[0]} → {f.paradas.at(-1)} {f.hora}</span>)}
        <span><i className="parada" />Parada</span>
        <small className="muted">Haz clic en una celda para cambiarla a mano.</small>
      </div>
    </>
  )
}

export default function PanelCoop() {
  const { sesion, cooperativas, buses, frecuencias } = useApp()
  const [tab, setTab] = useState('hoja')
  const coop = cooperativas.find((c) => c.id === sesion.coopId)
  if (!coop) return <div className="contenedor vacio"><b>Tu usuario no tiene una cooperativa asignada.</b></div>
  const misBuses = buses.filter((b) => b.coopId === coop.id)
  const misFrecs = frecuencias.filter((f) => f.coopId === coop.id)

  return (
    <div className="contenedor">
      <div className="seccion-cab izq">
        <h1>Cooperativa {coop.nombre}</h1>
        <p>Administra tu flota, las frecuencias asignadas y la hoja de ruta que alimenta la venta.</p>
      </div>
      <div className="tabs">
        <button className={tab === 'hoja' ? 'on' : ''} onClick={() => setTab('hoja')}>Hoja de ruta</button>
        <button className={tab === 'frec' ? 'on' : ''} onClick={() => setTab('frec')}>Frecuencias <i>{misFrecs.length}</i></button>
        <button className={tab === 'buses' ? 'on' : ''} onClick={() => setTab('buses')}>Buses <i>{misBuses.length}</i></button>
      </div>
      {tab === 'hoja' && <TabHoja coop={coop} misBuses={misBuses} misFrecs={misFrecs} />}
      {tab === 'frec' && <TabFrecuencias coop={coop} misFrecs={misFrecs} />}
      {tab === 'buses' && <TabBuses coop={coop} misBuses={misBuses} />}
    </div>
  )
}
