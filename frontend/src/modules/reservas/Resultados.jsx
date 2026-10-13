import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../../context/AppContext'

import { buscarViajes, estadoRango, finHoja } from '../../data/viajes'
import { TIPOS_BUS, fotoBus } from '../../data/mock'
import CoopLogo from '../../components/CoopLogo'
import { addDays, fechaLarga, hoy } from '../../data/fechas'

function Modal({ viaje, coop, onCerrar }) {
  const b = viaje.bus
  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-x" onClick={onCerrar}>âœ•</button>
        <img src={fotoBus(coop, b.tipo)} alt={TIPOS_BUS[b.tipo].nombre} className="modal-bus foto" />
        <div className="modal-tit"><CoopLogo coop={coop} size={44} /><h3>Bus N.Âº {b.numero} Â· {coop.nombre}</h3></div>
        <dl className="ficha">
          <div><dt>Tipo</dt><dd>{TIPOS_BUS[b.tipo].nombre}</dd></div>
          <div><dt>Placa</dt><dd>{b.placa}</dd></div>
          <div><dt>Chasis</dt><dd>{b.chasis}</dd></div>
          <div><dt>CarrocerÃ­a</dt><dd>{b.carroceria}</dd></div>
          <div><dt>Capacidad</dt><dd>{TIPOS_BUS[b.tipo].asientos} asientos</dd></div>
          <div><dt>ResoluciÃ³n ANT</dt><dd>{viaje.f.resolucion}</dd></div>
        </dl>
        {viaje.f.tipo === 'compartida' && (
          <p className="paradas-txt">Paradas: {viaje.f.paradas.join(' â†’ ')}</p>
        )}
      </div>
    </div>
  )
}

export default function Resultados() {
  const [q, setQ] = useSearchParams()
  const nav = useNavigate()
  const { frecuencias, hojas, buses, ocupacion, cooperativas, ciudades } = useApp()
  const origen = q.get('origen') || 'Ambato'
  const destino = q.get('destino') || 'Quito'
  const fecha = q.get('fecha') || addDays(hoy(), 1)
  const n = Number(q.get('n') || 1)

  const [fCoop, setFCoop] = useState('todas')
  const [fAsiento, setFAsiento] = useState('todos')
  const [fChasis, setFChasis] = useState('todos')
  const [fCarro, setFCarro] = useState('todos')
  const [fViaje, setFViaje] = useState('todos')
  const [ver, setVer] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    setCargando(true)
    const t = setTimeout(() => setCargando(false), 650)
    return () => clearTimeout(t)
  }, [origen, destino, fecha])

  const rango = estadoRango(frecuencias, hojas, fecha, origen, destino)
  const todos = useMemo(
    () => (rango === 'ok' ? buscarViajes({ frecuencias, hojas, buses, ocupacion, origen, destino, fecha }) : []),
    [rango, frecuencias, hojas, buses, ocupacion, origen, destino, fecha]
  )

  const marcasChasis = [...new Set(buses.map((b) => b.chasis))]
  const marcasCarro = [...new Set(buses.map((b) => b.carroceria))]

  const lista = todos.filter(
    (v) =>
      (fCoop === 'todas' || v.f.coopId === fCoop) &&
      (fChasis === 'todos' || v.bus.chasis === fChasis) &&
      (fCarro === 'todos' || v.bus.carroceria === fCarro) &&
      (fViaje === 'todos' || v.f.tipo === fViaje) &&
      (fAsiento === 'todos' || (fAsiento === 'vip' ? v.bus.tipo !== 'chiva' : true))
  )

  const cambiar = (clave, valor) => {
    const nuevo = new URLSearchParams(q)
    nuevo.set(clave, valor)
    setQ(nuevo)
  }

  return (
    <div className="contenedor resultados">
      <div className="barra-ruta">
        <div className="ruta-sel">
          <select value={origen} onChange={(e) => cambiar('origen', e.target.value)}>
            {ciudades.map((c) => <option key={c}>{c}</option>)}
          </select>
          <span>â†’</span>
          <select value={destino} onChange={(e) => cambiar('destino', e.target.value)}>
            {ciudades.map((c) => <option key={c}>{c}</option>)}
          </select>
          <input type="date" value={fecha} min={hoy()} onChange={(e) => cambiar('fecha', e.target.value)} />
        </div>
        <p className="muted">{fechaLarga(fecha)} Â· {n} pasajero{n > 1 ? 's' : ''}</p>
      </div>

      <div className="res-grid">
        <aside className="filtros">
          <h4>Filtrar</h4>
          <label>Cooperativa
            <select value={fCoop} onChange={(e) => setFCoop(e.target.value)}>
              <option value="todas">Todas</option>
              {cooperativas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </label>
          <label>Tipo de asiento
            <select value={fAsiento} onChange={(e) => setFAsiento(e.target.value)}>
              <option value="todos">Todos</option>
              <option value="vip">Con asientos VIP</option>
            </select>
          </label>
          <label>Marca del chasis
            <select value={fChasis} onChange={(e) => setFChasis(e.target.value)}>
              <option value="todos">Todas</option>
              {marcasChasis.map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
          <label>CarrocerÃ­a
            <select value={fCarro} onChange={(e) => setFCarro(e.target.value)}>
              <option value="todos">Todas</option>
              {marcasCarro.map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
          <label>Tipo de viaje
            <select value={fViaje} onChange={(e) => setFViaje(e.target.value)}>
              <option value="todos">Cualquiera</option>
              <option value="directa">Directo</option>
              <option value="compartida">Con paradas</option>
            </select>
          </label>
        </aside>

        <section className="lista">
          {cargando && [0, 1, 2].map((k) => (
            <div key={k} className="viaje esqueleto" aria-hidden="true">
              <div className="sk sk-bus" />
              <div className="sk-col"><div className="sk sk-l1" /><div className="sk sk-l2" /><div className="sk sk-l3" /></div>
              <div className="sk-col"><div className="sk sk-l1" /><div className="sk sk-btn" /></div>
            </div>
          ))}
          {!cargando && rango === 'sin-ruta' && <div className="vacio"><b>No hay frecuencias entre {origen} y {destino}.</b><p>Prueba con otra ciudad cercana o revisa el orden de origen y destino.</p></div>}
          {rango === 'pasado' && <div className="vacio"><b>Esa fecha ya pasÃ³.</b></div>}
          {rango?.fuera && (
            <div className="vacio">
              <b>TodavÃ­a no se pueden comprar boletos para esa fecha.</b>
              <p>La hoja de ruta de las cooperativas llega hasta el {fechaLarga(rango.fuera)}.</p>
              <button className="btn btn-oscuro" onClick={() => cambiar('fecha', rango.fuera)}>Ir a la Ãºltima fecha disponible</button>
            </div>
          )}
          {rango === 'ok' && lista.length === 0 && <div className="vacio"><b>No hay salidas ese dÃ­a con esos filtros.</b><p>Prueba otra fecha o quita algÃºn filtro.</p></div>}

          {lista.map((v) => {
            const coop = cooperativas.find((c) => c.id === v.f.coopId)
            return (
              <article key={v.id} className="viaje">
                <div className="viaje-bus">
                  <img src={fotoBus(coop, v.bus.tipo)} alt={TIPOS_BUS[v.bus.tipo].nombre} className="foto-bus" loading="lazy" />
                </div>
                <div className="viaje-mid">
                  <div className="horas">
                    <b>{v.f.hora}</b>
                    <small>{v.origen}</small>
                  </div>
                  <div className="linea"><i /><span>{v.f.duracion}</span></div>
                  <div className="horas">
                    <b>{v.destino}</b>
                    <small>{v.f.tipo === 'directa' ? 'Directo' : `${v.f.paradas.length - 2} ${v.f.paradas.length === 3 ? 'parada' : 'paradas'}`}</small>
                  </div>
                  <div className="badges">
                    <span className={'badge ' + (v.f.tipo === 'directa' ? 'verde' : 'ambar')}>{v.f.tipo === 'directa' ? 'Directo' : 'Con paradas'}</span>
                    <span className="badge gris">{TIPOS_BUS[v.bus.tipo].nombre}</span>
                    <button className="btn-link" onClick={() => setVer(v)}>Ver bus</button>
                  </div>
                </div>
                <div className="viaje-der">
                  <b className="precio">${v.precio.toFixed(2)}</b>
                  <small>{v.libres} asientos libres</small>
                  <Link className="btn btn-acento" to={`/comprar/${v.id}?origen=${v.origen}&destino=${v.destino}&n=${n}`}>Elegir asientos</Link>
                </div>
              </article>
            )
          })}
          {rango === 'ok' && <p className="nota-hoja muted">Venta abierta hasta el {fechaLarga(finHoja(hojas.amazonas))} segÃºn la hoja de ruta vigente.</p>}
        </section>
      </div>
      {ver && <Modal viaje={ver} coop={cooperativas.find((c) => c.id === ver.f.coopId)} onCerrar={() => setVer(null)} />}
    </div>
  )
}

