import Dialogo from '../../components/ui/Dialogo'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useBusquedaViajes } from './useBusquedaViajes'
import { useCiudades } from './useCiudades'
import { usePersonalizacion } from '../../context/PersonalizacionContext'
import { urlCompra } from './reservas.enlaces'
import { OPCIONES_FRANJA, OPCIONES_ORDEN, filtrarPorFranja, ordenarViajes } from './reservas.orden'

import { TIPOS_BUS, fotoBus } from '../../data/mock'
import CoopLogo from '../../components/CoopLogo'
import { addDays, fechaLarga, hoy } from '../../data/fechas'

function Modal({ viaje, onCerrar }) {
  const b = viaje.bus
  return (
    <Dialogo overlayProps={{"className": "modal-fondo", "onClick": onCerrar}} panelProps={{"className": "modal", "onClick": (e) => e.stopPropagation()}}>
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
        {viaje.paradas.length > 0 && (
          <div className="paradas-txt">
            <b>Recorrido</b>
            <ol style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'grid', gap: 6 }}>
              {viaje.paradas.map((p) => (
                <li key={p.orden} style={{ display: 'flex', gap: 12 }}>
                  <b style={{ minWidth: 48 }}>{p.hora}</b>
                  <span>{p.terminal}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </Dialogo>
  )
}


export default function Resultados() {
  const [q, setQ] = useSearchParams()
  const origen = q.get('origen') || 'Ambato'
  const destino = q.get('destino') || 'Quito'
  const fecha = q.get('fecha') || addDays(hoy(), 1)
  const n = Math.max(1, Number(q.get('n')) || 1)

  const { cooperativaId } = usePersonalizacion()
  const [fAsiento, setFAsiento] = useState('todos')
  const [fViaje, setFViaje] = useState('todos')
  const [fFranja, setFFranja] = useState('todos')
  const [orden, setOrden] = useState('hora')
  const [ver, setVer] = useState(null)

  const { viajes, cargando, error, reintentar } = useBusquedaViajes({ origen, destino, fecha, cooperativa: cooperativaId || undefined })
  const { ciudades } = useCiudades(cooperativaId || undefined)
  // La ciudad buscada siempre figura en su selector, aunque la lista aun no haya llegado.
  const opcionesCon = (actual) => (ciudades.includes(actual) ? ciudades : [actual, ...ciudades])



  const filtrados = viajes.filter(
    (v) =>
      (fViaje === 'todos' || v.tipoViaje === fViaje) &&
      (fAsiento === 'todos' || (fAsiento === 'normal' ? v.precioNormal !== null : v.precioVip !== null))
  )
  const lista = ordenarViajes(filtrarPorFranja(filtrados, fFranja), orden)

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
            {opcionesCon(origen).map((c) => <option key={c}>{c}</option>)}
          </select>
          <span>→</span>
          <select value={destino} onChange={(e) => cambiar('destino', e.target.value)}>
            {opcionesCon(destino).map((c) => <option key={c}>{c}</option>)}
          </select>
          <input type="date" value={fecha} min={hoy()} onChange={(e) => cambiar('fecha', e.target.value)} />
        </div>
        <p className="muted">{fechaLarga(fecha)} · {n} pasajero{n > 1 ? 's' : ''}</p>
      </div>

      <div className="res-grid">
        <aside className="filtros">
          <h4>Ordenar y filtrar</h4>
          <label>Ordenar por
            <select value={orden} onChange={(e) => setOrden(e.target.value)}>
              {OPCIONES_ORDEN.map((o) => <option key={o.valor} value={o.valor}>{o.nombre}</option>)}
            </select>
          </label>
          <label>Horario de salida
            <select value={fFranja} onChange={(e) => setFFranja(e.target.value)}>
              {OPCIONES_FRANJA.map((o) => <option key={o.valor} value={o.valor}>{o.nombre}</option>)}
            </select>
          </label>
          <label>Tipo de asiento
            <select value={fAsiento} onChange={(e) => setFAsiento(e.target.value)}>
              <option value="todos">Todos</option>
              <option value="normal">Normal</option><option value="vip">VIP</option>
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
                  <Link className="btn btn-acento" to={urlCompra(v.id, { origen, destino, fecha, pasajeros: n, cooperativa: v.coop.id })}>Elegir asientos</Link>
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
