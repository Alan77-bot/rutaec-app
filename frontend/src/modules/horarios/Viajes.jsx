import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { rutasService } from '../rutas/services/rutas.service'
import { horariosService } from './services/horarios.service'

const ESTADOS = {
  PUBLICADO: { texto: 'Publicado', clase: 'verde' },
  BORRADOR: { texto: 'Borrador', clase: 'ambar' },
  CERRADO: { texto: 'Cerrado', clase: 'gris' },
  CANCELADO: { texto: 'Cancelado', clase: 'rojo' },
}

const fila = { display: 'flex', gap: 8, alignItems: 'flex-end' }
// En una fila, cada campo ocupa su parte sin salirse del panel.
const campo = { flex: 1, minWidth: 0 }
const entrada = { width: '100%', boxSizing: 'border-box' }

function fechaEcuador(diasDesdeHoy) {
  const ms = Date.now() + diasDesdeHoy * 24 * 60 * 60 * 1000
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil' }).format(ms)
}

async function pedirCooperativas() {
  const respuesta = await fetch('/api/cooperativas', { credentials: 'include' })
  if (!respuesta.ok) throw new Error('No se pudieron cargar las cooperativas.')
  const cuerpo = await respuesta.json()
  return cuerpo.datos
}

// Tramos vendibles de una ruta: de una parada con subida a otra posterior con bajada.
function tramosDe(ruta) {
  if (!ruta) return []
  const tramos = []
  for (const o of ruta.paradas) {
    if (!o.permite_subida) continue
    for (const d of ruta.paradas) {
      if (d.orden > o.orden && d.permite_bajada) {
        tramos.push({ o: o.orden, d: d.orden, texto: `${o.ciudad} → ${d.ciudad}` })
      }
    }
  }
  return tramos
}

export default function Viajes() {
  const { sesion, ejecutar } = useApp()
  const esCoop = sesion?.rol === 'cooperativa'

  const formVacio = () => ({
    cooperativa_id: esCoop ? (sesion.coopId ?? '') : '',
    frecuencia_id: '',
    bus_id: '',
    desde: fechaEcuador(1),
    hasta: fechaEcuador(7),
    minutos_cierre: '60',
    fuente_normativa: '',
    tarifas: {},
  })

  const [filtro, setFiltro] = useState({ desde: fechaEcuador(0), hasta: fechaEcuador(14) })
  const [viajes, setViajes] = useState([])
  const [frecuencias, setFrecuencias] = useState([])
  const [rutas, setRutas] = useState([])
  const [cooperativas, setCooperativas] = useState([])
  const [buses, setBuses] = useState([])
  const [form, setForm] = useState(formVacio)
  const [resultado, setResultado] = useState(null)
  const [cancelando, setCancelando] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  const cargarViajes = useCallback(async () => {
    const datos = await horariosService.listarViajes({
      ...filtro,
      cooperativa_id: esCoop ? undefined : form.cooperativa_id || undefined,
    })
    setViajes(datos)
  }, [filtro, esCoop, form.cooperativa_id])

  useEffect(() => {
    Promise.all([
      horariosService.listarFrecuencias(),
      rutasService.listarRutas(),
      esCoop ? Promise.resolve([]) : pedirCooperativas(),
    ])
      .then(([f, r, c]) => {
        setFrecuencias(f)
        setRutas(r)
        setCooperativas(c)
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
  }, [esCoop])

  useEffect(() => {
    cargarViajes().catch((e) => setError(e.message))
  }, [cargarViajes])

  // Los buses dependen de la cooperativa elegida.
  useEffect(() => {
    if (!form.cooperativa_id) {
      setBuses([])
      return
    }
    horariosService
      .listarBuses(esCoop ? undefined : form.cooperativa_id)
      .then(setBuses)
      .catch((e) => setError(e.message))
  }, [form.cooperativa_id, esCoop])

  const frecuenciasDeCoop = frecuencias.filter(
    (f) => f.cooperativa_id === form.cooperativa_id && f.activa
  )
  const frecuencia = frecuencias.find((f) => f.id === form.frecuencia_id)
  const ruta = rutas.find((r) => r.id === frecuencia?.ruta_id)
  const tramos = useMemo(() => tramosDe(ruta), [ruta])
  const bus = buses.find((b) => b.id === form.bus_id)
  const pideVip = (bus?.asientos_vip ?? 0) > 0

  const cambiarTarifa = (clave, campo, valor) =>
    setForm((f) => ({
      ...f,
      tarifas: { ...f.tarifas, [clave]: { ...f.tarifas[clave], [campo]: valor } },
    }))

  const programar = async (e) => {
    e.preventDefault()
    const entrada = {
      frecuencia_id: form.frecuencia_id,
      bus_id: form.bus_id,
      desde: form.desde,
      hasta: form.hasta,
      minutos_cierre: Number(form.minutos_cierre),
      fuente_normativa: form.fuente_normativa.trim(),
      tarifas: tramos.map((t) => {
        const valor = form.tarifas[`${t.o}-${t.d}`] ?? {}
        return {
          origen_orden: t.o,
          destino_orden: t.d,
          normal: Number(valor.normal),
          vip: pideVip ? Number(valor.vip) : null,
        }
      }),
    }
    const r = await ejecutar(() => horariosService.programarViajes(entrada))
    if (r.ok) {
      setResultado(r.datos)
      await cargarViajes()
    }
  }

  const confirmarCancelacion = async () => {
    const r = await ejecutar(
      () => horariosService.cancelarViaje(cancelando.id, cancelando.motivo.trim()),
      'Viaje cancelado.'
    )
    if (r.ok) {
      setCancelando(null)
      await cargarViajes()
    }
  }

  if (cargando) return <div className="splash" role="status">Cargando programación...</div>

  return (
    <div className="contenedor">
      <div className="seccion-cab izq">
        <h1>Programación de viajes</h1>
        <p>Genera los viajes de cada frecuencia con su bus, sus tarifas por tramo y sus asientos.</p>
      </div>

      {error && <p role="alert">{error}</p>}

      <div className="dos-col">
        <div>
          <div className="panel" style={fila}>
            <label style={campo}>
              Desde
              <input type="date" style={entrada} value={filtro.desde} onChange={(e) => setFiltro({ ...filtro, desde: e.target.value })} />
            </label>
            <label style={campo}>
              Hasta
              <input type="date" style={entrada} value={filtro.hasta} onChange={(e) => setFiltro({ ...filtro, hasta: e.target.value })} />
            </label>
          </div>

          <div className="tabla-wrap">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Ruta</th>
                  <th>Bus</th>
                  <th>Ocupación</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {viajes.length === 0 && (
                  <tr>
                    <td colSpan={6}>No hay viajes programados en esas fechas.</td>
                  </tr>
                )}
                {viajes.map((v) => {
                  const estado = ESTADOS[v.estado] ?? ESTADOS.BORRADOR
                  const libreDeVentas = v.vendidos === 0 && v.reservados === 0
                  return (
                    <tr key={v.id} className={v.estado === 'CANCELADO' ? 'inactiva' : ''}>
                      <td>
                        <b>{v.fecha}</b>
                        <small>{v.salida} – {v.llegada}</small>
                      </td>
                      <td>
                        {v.ruta}
                        <small>{v.frecuencia} · {v.cooperativa}</small>
                      </td>
                      <td>
                        N.º {v.bus.numero_unidad}
                        <small>{v.bus.placa}</small>
                      </td>
                      <td>
                        {v.vendidos}/{v.asientos}
                        <small>{v.reservados} reservados</small>
                      </td>
                      <td>
                        <span className={'badge ' + estado.clase}>{estado.texto}</span>
                        {v.motivo_cancelacion && <small>{v.motivo_cancelacion}</small>}
                      </td>
                      <td>
                        {v.estado === 'PUBLICADO' && libreDeVentas && cancelando?.id !== v.id && (
                          <button type="button" className="btn-link rojo" onClick={() => setCancelando({ id: v.id, motivo: '' })}>
                            Cancelar
                          </button>
                        )}
                        {cancelando?.id === v.id && (
                          <div>
                            <input
                              style={{ ...entrada, minWidth: 140 }}
                              aria-label="Motivo de la cancelación"
                              placeholder="Motivo"
                              value={cancelando.motivo}
                              onChange={(e) => setCancelando({ ...cancelando, motivo: e.target.value })}
                            />
                            <button type="button" className="btn-link rojo" disabled={cancelando.motivo.trim().length < 5} onClick={confirmarCancelacion}>
                              Confirmar
                            </button>
                            <button type="button" className="btn-link" onClick={() => setCancelando(null)}>
                              Volver
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <form className="panel" onSubmit={programar}>
          <h4>Programar viajes</h4>

          {!esCoop && (
            <label>
              Cooperativa
              <select
                value={form.cooperativa_id}
                onChange={(e) => setForm({ ...formVacio(), cooperativa_id: e.target.value })}
                required
              >
                <option value="">Selecciona...</option>
                {cooperativas.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre_comercial}</option>
                ))}
              </select>
            </label>
          )}

          <label>
            Frecuencia
            <select
              value={form.frecuencia_id}
              onChange={(e) => setForm({ ...form, frecuencia_id: e.target.value, tarifas: {} })}
              required
            >
              <option value="">Selecciona una frecuencia...</option>
              {frecuenciasDeCoop.map((f) => (
                <option key={f.id} value={f.id}>{f.codigo} · {f.ruta} · {f.hora_salida}</option>
              ))}
            </select>
          </label>

          <label>
            Bus
            <select value={form.bus_id} onChange={(e) => setForm({ ...form, bus_id: e.target.value })} required>
              <option value="">Selecciona un bus...</option>
              {buses.map((b) => (
                <option key={b.id} value={b.id} disabled={b.estado !== 'ACTIVO' || b.asientos_activos !== b.capacidad}>
                  N.º {b.numero_unidad} · {b.placa} · {b.capacidad} asientos{b.asientos_vip > 0 ? ` (${b.asientos_vip} VIP)` : ''}
                </option>
              ))}
            </select>
          </label>

          <div style={fila}>
            <label style={campo}>
              Desde
              <input type="date" style={entrada} value={form.desde} min={fechaEcuador(0)} onChange={(e) => setForm({ ...form, desde: e.target.value })} required />
            </label>
            <label style={campo}>
              Hasta
              <input type="date" style={entrada} value={form.hasta} min={form.desde} onChange={(e) => setForm({ ...form, hasta: e.target.value })} required />
            </label>
          </div>

          <label>
            Cierre de ventas (minutos antes de la salida)
            <input type="number" min="0" max="1440" value={form.minutos_cierre} onChange={(e) => setForm({ ...form, minutos_cierre: e.target.value })} required />
          </label>

          <label>
            Fuente normativa de las tarifas
            <input
              value={form.fuente_normativa}
              onChange={(e) => setForm({ ...form, fuente_normativa: e.target.value })}
              placeholder="Resolución ANT de tarifas 2026"
              required
            />
          </label>

          {tramos.length > 0 && (
            <>
              <p><b>Tarifas por tramo (USD)</b></p>
              {tramos.map((t) => {
                const clave = `${t.o}-${t.d}`
                const valor = form.tarifas[clave] ?? {}
                return (
                  <div key={clave} style={fila}>
                    <label style={{ ...campo, flex: 2 }}>
                      {t.texto}
                      <input type="number" style={entrada} min="0.01" step="0.01" placeholder="Normal" value={valor.normal ?? ''} onChange={(e) => cambiarTarifa(clave, 'normal', e.target.value)} required />
                    </label>
                    {pideVip && (
                      <label style={campo}>
                        VIP
                        <input type="number" style={entrada} min="0.01" step="0.01" placeholder="VIP" value={valor.vip ?? ''} onChange={(e) => cambiarTarifa(clave, 'vip', e.target.value)} required />
                      </label>
                    )}
                  </div>
                )
              })}
            </>
          )}

          <button className="btn btn-oscuro">Programar viajes</button>

          {resultado && (
            <div role="status">
              <p><b>Se programaron {resultado.creados.length} viajes.</b></p>
              {resultado.omitidos.length > 0 && (
                <ul>
                  {resultado.omitidos.map((o) => (
                    <li key={o.fecha}><small>{o.fecha}: {o.motivo}</small></li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
