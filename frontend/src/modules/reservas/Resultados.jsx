import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { useBusquedaViajes } from './useBusquedaViajes'

import { TIPOS_BUS, fotoBus } from '../../data/mock'
import CoopLogo from '../../components/CoopLogo'
import { addDays, fechaLarga, hoy } from '../../data/fechas'

function Modal({ viaje, onCerrar }) {
  const b = viaje.bus
  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-x" onClick={onCerrar}>✕</button>
        <img src={b.imagen || fotoBus(null, b.tipo)} alt={TIPOS_BUS[b.tipo].nombre} className="modal-bus foto" />
        <div className="modal-tit"><CoopLogo coop={viaje.coop} size={44} /><h3>Bus N.º {b.numero} · {viaje.coop.nombre}</h3></div>
        <dl className="ficha">
          <div><dt>Tipo</dt><dd>{TIPOS_BUS[b.tipo].nombre}</dd></div>
          <div><dt>Placa</dt><dd>{b.placa}</dd></div>
          <div><dt>Chasis</dt><dd>{b.chasis}</dd></div>
          <div><dt>Carrocería</dt><dd>{b.carroceria}</dd></div>
          <div><dt>Capacidad</dt><dd>{b.capacidad} asientos</dd></div>
          <div><dt>Salida</dt><dd>{viaje.horaSalida} · {viaje.origenTerminal}</dd></div>
          <div><dt>Llegada</dt><dd>{viaje.horaLlegada} · {viaje.destinoTerminal}</dd></div>
        </dl>
        {viaje.tipoViaje === 'compartida' && (
          <p className="paradas-txt">
            {viaje.paradasIntermedias} {viaje.paradasIntermedias === 1 ? 'parada intermedia' : 'paradas intermedias'} entre {viaje.origen} y {viaje.destino}
          </p>
        )}
      </div>
    </div>
  )
}

// Un filtro solo se aplica si su valor sigue existiendo en los resultados actuales.
const vigente = (valor, opciones) => (opciones.includes(valor) ? valor : 'todos')

export default function Resultados() {
  const [q, setQ] = useSearchParams()
  const { ciudades } = useApp()
  const origen = q.get('origen') || 'Ambato'
  const destino = q.get('destino') || 'Quito'
  const fecha = q.get('fecha') || addDays(hoy(), 1)
  const n = Math.max(1, Number(q.get('n')) || 1)

  const [fCoop, setFCoop] = useState('todos')
  const [fAsiento, setFAsiento] = useState('todos')
  const [fChasis, setFChasis] = useState('todos')
  const [fCarro, setFCarro] = useState('todos')
  const [fViaje, setFViaje] = useState('todos')
  const [ver, setVer] = useState(null)

  const { viajes, cargando, error, reintentar } = useBusquedaViajes({ origen, destino, fecha })

  const cooperativas = useMemo(() => {
    const porId = new Map(viajes.map((v) => [v.coop.id, v.coop]))
    return [...porId.values()]
  }, [viajes])
  const marcasChasis = useMemo(() => [...new Set(viajes.map((v) => v.bus.chasis))], [viajes])
  const marcasCarro = useMemo(() => [...new Set(viajes.map((v) => v.bus.carroceria))], [viajes])

  const coopActiva = vigente(fCoop, cooperativas.map((c) => c.id))
  const chasisActivo = vigente(fChasis, marcasChasis)
  const carroActiva = vigente(fCarro, marcasCarro)

  const lista = viajes.filter(
    (v) =>
      (coopActiva === 'todos' || v.coop.id === coopActiva) &&
      (chasisActivo === 'todos' || v.bus.chasis === chasisActivo) &&
      (carroActiva === 'todos' || v.bus.carroceria === carroActiva) &&
      (fViaje === 'todos' || v.tipoViaje === fViaje) &&
      (fAsiento === 'todos' || v.precioVip !== null)
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
          <span>→</span>
          <select value={destino} onChange={(e) => cambiar('destino', e.target.value)}>
            {ciudades.map((c) => <option key={c}>{c}</option>)}
          </select>
          <input type="date" value={fecha} min={hoy()} onChange={(e) => cambiar('fecha', e.target.value)} />
        </div>
        <p className="muted">{fechaLarga(fecha)} · {n} pasajero{n > 1 ? 's' : ''}</p>
      </div>

      <div className="res-grid">
        <aside className="filtros">
          <h4>Filtrar</h4>
          <label>Cooperativa
            <select value={coopActiva} onChange={(e) => setFCoop(e.target.value)}>
              <option value="todos">Todas</option>
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
            <select value={chasisActivo} onChange={(e) => setFChasis(e.target.value)}>
              <option value="todos">Todas</option>
              {marcasChasis.map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
          <label>Carrocería
            <select value={carroActiva} onChange={(e) => setFCarro(e.target.value)}>
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
          {!cargando && error && error.code === 'FECHA_PASADA' && (
            <div className="vacio">
              <b>Esa fecha ya pasó.</b>
              <p>Elige una fecha desde hoy para ver las salidas disponibles.</p>
              <button className="btn btn-oscuro" onClick={() => cambiar('fecha', hoy())}>Buscar para hoy</button>
            </div>
          )}
          {!cargando && error && error.code !== 'FECHA_PASADA' && (
            <div className="vacio">
              <b>{error.message}</b>
              {(error.estado === 0 || error.estado >= 500) && (
                <button className="btn btn-oscuro" onClick={reintentar}>Reintentar</button>
              )}
            </div>
          )}
          {!cargando && !error && viajes.length === 0 && (
            <div className="vacio">
              <b>No hay salidas de {origen} a {destino} ese día.</b>
              <p>Prueba con otra fecha o revisa el orden de origen y destino.</p>
            </div>
          )}
          {!cargando && !error && viajes.length > 0 && lista.length === 0 && (
            <div className="vacio"><b>No hay salidas ese día con esos filtros.</b><p>Prueba otra fecha o quita algún filtro.</p></div>
          )}

          {lista.map((v) => {
            const sinTarifa = v.precio === null
            const faltanAsientos = v.libres < n
            const noDisponible = sinTarifa || faltanAsientos
            return (
            <article key={`${v.id}-${v.origen}-${v.destino}`} className="viaje">
              <div className="viaje-bus">
                <img src={v.bus.imagen || fotoBus(null, v.bus.tipo)} alt={TIPOS_BUS[v.bus.tipo].nombre} className="foto-bus" loading="lazy" />
              </div>
              <div className="viaje-mid">
                <div className="horas">
                  <b>{v.horaSalida}</b>
                  <small>{v.origen}</small>
                </div>
                <div className="linea"><i /><span>{v.duracion}</span></div>
                <div className="horas">
                  <b>{v.destino}</b>
                  <small>{v.tipoViaje === 'directa' ? 'Directo' : `${v.paradasIntermedias} ${v.paradasIntermedias === 1 ? 'parada' : 'paradas'}`}</small>
                </div>
                <div className="badges">
                  <span className={'badge ' + (v.tipoViaje === 'directa' ? 'verde' : 'ambar')}>{v.tipoViaje === 'directa' ? 'Directo' : 'Con paradas'}</span>
                  <span className="badge gris">{TIPOS_BUS[v.bus.tipo].nombre}</span>
                  <span className="badge gris">{v.coop.nombre}</span>
                  <button className="btn-link" onClick={() => setVer(v)}>Ver bus</button>
                </div>
              </div>
              <div className="viaje-der">
                <b className="precio">{v.precio !== null ? `$${v.precio.toFixed(2)}` : 'Sin tarifa'}</b>
                <small>
                  {v.libres === 0
                    ? 'Sin asientos libres'
                    : faltanAsientos
                      ? `Solo quedan ${v.libres} ${v.libres === 1 ? 'asiento' : 'asientos'} (necesitas ${n})`
                      : `${v.libres} asientos libres`}
                </small>
                {noDisponible ? (
                  <button className="btn btn-acento" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                    {sinTarifa ? 'Sin tarifa' : v.libres === 0 ? 'Agotado' : 'No alcanzan'}
                  </button>
                ) : (
                  <Link className="btn btn-acento" to={`/comprar/${v.id}?origen=${v.origen}&destino=${v.destino}&n=${n}`}>Elegir asientos</Link>
                )}
              </div>
            </article>
            )
          })}
        </section>
      </div>
      {ver && <Modal viaje={ver} onCerrar={() => setVer(null)} />}
    </div>
  )
}
