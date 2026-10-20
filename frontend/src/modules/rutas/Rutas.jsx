import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { rutasService } from './services/rutas.service'

async function pedirCooperativas() {
  const respuesta = await fetch('/api/cooperativas', { credentials: 'include' })
  if (!respuesta.ok) throw new Error('No se pudieron cargar las cooperativas.')
  const cuerpo = await respuesta.json()
  return cuerpo.datos
}

const textoRecorrido = (ruta) => ruta.paradas.map((p) => p.ciudad).join(' → ')

export default function Rutas() {
  const { sesion, ejecutar } = useApp()
  const esCoop = sesion?.rol === 'cooperativa'

  const formVacio = () => ({
    cooperativa_id: esCoop ? (sesion.coopId ?? '') : '',
    nombre: '',
    paradas: [
      { terminal_id: '', minutos: '0' },
      { terminal_id: '', minutos: '' },
    ],
  })

  const [rutas, setRutas] = useState([])
  const [terminales, setTerminales] = useState([])
  const [cooperativas, setCooperativas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(formVacio)

  const cargar = useCallback(async () => {
    try {
      const [r, t, c] = await Promise.all([
        rutasService.listarRutas(),
        rutasService.listarTerminales(),
        pedirCooperativas(),
      ])
      setRutas(r)
      setTerminales(t)
      setCooperativas(c)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  const visibles = esCoop ? rutas.filter((r) => r.cooperativa_id === sesion.coopId) : rutas

  const cambiarParada = (i, campo, valor) =>
    setForm((f) => ({
      ...f,
      paradas: f.paradas.map((p, k) => (k === i ? { ...p, [campo]: valor } : p)),
    }))

  const agregarParada = () =>
    setForm((f) => ({ ...f, paradas: [...f.paradas, { terminal_id: '', minutos: '' }] }))

  const quitarParada = (i) =>
    setForm((f) => ({ ...f, paradas: f.paradas.filter((_, k) => k !== i) }))

  const guardar = async (e) => {
    e.preventDefault()
    const entrada = {
      cooperativa_id: form.cooperativa_id,
      nombre: form.nombre.trim(),
      paradas: form.paradas.map((p, i) => ({
        terminal_id: p.terminal_id,
        minutos_desde_origen: i === 0 ? 0 : Number(p.minutos),
      })),
    }
    const r = await ejecutar(() => rutasService.crearRuta(entrada), 'Ruta registrada.')
    if (r.ok) {
      setForm(formVacio())
      await cargar()
    }
  }

  const alternar = async (ruta) => {
    const r = await ejecutar(
      () => rutasService.actualizarRuta(ruta.id, { activa: !ruta.activa }),
      ruta.activa ? 'Ruta desactivada.' : 'Ruta activada.'
    )
    if (r.ok) await cargar()
  }

  if (cargando) return <div className="splash" role="status">Cargando rutas...</div>

  return (
    <div className="contenedor">
      <div className="seccion-cab izq">
        <h1>Rutas</h1>
        <p>Recorridos de cada cooperativa con sus paradas intermedias.</p>
      </div>

      {error && <p role="alert">{error}</p>}

      <div className="dos-col">
        <div className="tabla-wrap">
          <table className="tabla">
            <thead>
              <tr>
                <th>Ruta</th>
                <th>Recorrido</th>
                <th>Estado</th>
                <th>Activa</th>
              </tr>
            </thead>
            <tbody>
              {visibles.length === 0 && (
                <tr>
                  <td colSpan={4}>Todavía no hay rutas registradas.</td>
                </tr>
              )}
              {visibles.map((r) => (
                <tr key={r.id} className={r.activa ? '' : 'inactiva'}>
                  <td>
                    <b>{r.nombre}</b>
                    <small>{r.cooperativa}</small>
                  </td>
                  <td>
                    {textoRecorrido(r)}
                    <small>
                      {r.paradas.length} paradas · {r.paradas[r.paradas.length - 1]?.minutos_desde_origen ?? 0} min
                    </small>
                  </td>
                  <td>
                    <span className={'badge ' + (r.activa ? 'verde' : 'gris')}>
                      {r.activa ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={'switch' + (r.activa ? ' on' : '')}
                      onClick={() => alternar(r)}
                      aria-label={r.activa ? 'Desactivar ruta' : 'Activar ruta'}
                    >
                      <i />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form className="panel" onSubmit={guardar}>
          <h4>Nueva ruta</h4>

          {!esCoop && (
            <label>
              Cooperativa
              <select
                value={form.cooperativa_id}
                onChange={(e) => setForm({ ...form, cooperativa_id: e.target.value })}
                required
              >
                <option value="">Selecciona...</option>
                {cooperativas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre_comercial}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label>
            Nombre de la ruta
            <input
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Quito - Ambato"
              required
            />
          </label>

          <p><b>Paradas</b> <small className="ayuda">(la primera es el origen y la última el destino)</small></p>

          {form.paradas.map((p, i) => (
            <div key={i}>
              <label>
                {i === 0 ? 'Origen' : i === form.paradas.length - 1 ? 'Destino' : 'Parada ' + (i + 1)}
                <select
                  value={p.terminal_id}
                  onChange={(e) => cambiarParada(i, 'terminal_id', e.target.value)}
                  required
                >
                  <option value="">Selecciona una terminal...</option>
                  {terminales.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre} ({t.ciudades.nombre})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Minutos desde el origen
                <input
                  type="number"
                  min="0"
                  value={i === 0 ? '0' : p.minutos}
                  disabled={i === 0}
                  onChange={(e) => cambiarParada(i, 'minutos', e.target.value)}
                  required
                />
              </label>
              {form.paradas.length > 2 && i > 0 && (
                <button type="button" className="btn-link rojo" onClick={() => quitarParada(i)}>
                  Quitar parada
                </button>
              )}
            </div>
          ))}

          <p>
            <button type="button" className="btn-link" onClick={agregarParada}>
              + Agregar parada
            </button>
          </p>

          <button className="btn btn-oscuro">Registrar ruta</button>
        </form>
      </div>
    </div>
  )
}
