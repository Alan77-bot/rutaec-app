import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { rutasService } from '../rutas/services/rutas.service'
import { horariosService } from './services/horarios.service'

const DIAS = [
  { n: 1, corto: 'Lun' },
  { n: 2, corto: 'Mar' },
  { n: 3, corto: 'Mié' },
  { n: 4, corto: 'Jue' },
  { n: 5, corto: 'Vie' },
  { n: 6, corto: 'Sáb' },
  { n: 7, corto: 'Dom' },
]

async function pedirCooperativas() {
  const respuesta = await fetch('/api/cooperativas', { credentials: 'include' })
  if (!respuesta.ok) throw new Error('No se pudieron cargar las cooperativas.')
  const cuerpo = await respuesta.json()
  return cuerpo.datos
}

const textoDias = (dias) =>
  dias.length === 7
    ? 'Todos los días'
    : dias.map((d) => DIAS.find((x) => x.n === d)?.corto).join(', ')

export default function Frecuencias() {
  const { sesion, ejecutar } = useApp()
  const esCoop = sesion?.rol === 'cooperativa'

  const formVacio = () => ({
    cooperativa_id: esCoop ? (sesion.coopId ?? '') : '',
    codigo: '',
    ruta_id: '',
    resolucion_id: '',
    hora_salida: '',
    dias: [1, 2, 3, 4, 5],
  })

  const [frecuencias, setFrecuencias] = useState([])
  const [rutas, setRutas] = useState([])
  const [resoluciones, setResoluciones] = useState([])
  const [cooperativas, setCooperativas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(formVacio)

  const cargar = useCallback(async () => {
    try {
      const [f, r, c] = await Promise.all([
        horariosService.listarFrecuencias(),
        rutasService.listarRutas(),
        esCoop ? Promise.resolve([]) : pedirCooperativas(),
      ])
      setFrecuencias(f)
      setRutas(r)
      setCooperativas(c)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }, [esCoop])

  useEffect(() => {
    cargar()
  }, [cargar])

  // Las resoluciones dependen de la cooperativa elegida.
  useEffect(() => {
    if (!form.cooperativa_id) {
      setResoluciones([])
      return
    }
    horariosService
      .listarResoluciones(esCoop ? undefined : form.cooperativa_id)
      .then(setResoluciones)
      .catch((e) => setError(e.message))
  }, [form.cooperativa_id, esCoop])

  const visibles = esCoop
    ? frecuencias.filter((f) => f.cooperativa_id === sesion.coopId)
    : frecuencias
  const rutasDeCoop = rutas.filter(
    (r) => r.cooperativa_id === form.cooperativa_id && r.activa
  )

  const alternarDia = (n) =>
    setForm((f) => ({
      ...f,
      dias: f.dias.includes(n) ? f.dias.filter((d) => d !== n) : [...f.dias, n],
    }))

  const guardar = async (e) => {
    e.preventDefault()
    const entrada = {
      ...(esCoop ? {} : { cooperativa_id: form.cooperativa_id }),
      codigo: form.codigo.trim(),
      ruta_id: form.ruta_id,
      resolucion_id: form.resolucion_id,
      hora_salida: form.hora_salida,
      dias: [...form.dias].sort((a, b) => a - b),
    }
    const r = await ejecutar(
      () => horariosService.crearFrecuencia(entrada),
      'Frecuencia registrada.'
    )
    if (r.ok) {
      setForm(formVacio())
      await cargar()
    }
  }

  const alternar = async (f) => {
    const entrada = {
      codigo: f.codigo,
      ruta_id: f.ruta_id,
      resolucion_id: f.resolucion_id,
      hora_salida: f.hora_salida,
      dias: f.dias,
      activa: !f.activa,
    }
    const r = await ejecutar(
      () => horariosService.actualizarFrecuencia(f.id, entrada),
      f.activa ? 'Frecuencia desactivada.' : 'Frecuencia activada.'
    )
    if (r.ok) await cargar()
  }

  if (cargando) return <div className="splash" role="status">Cargando frecuencias...</div>

  return (
    <div className="contenedor">
      <div className="seccion-cab izq">
        <h1>Frecuencias</h1>
        <p>Horas de salida y días de operación de cada ruta.</p>
      </div>

      {error && <p role="alert">{error}</p>}

      <div className="dos-col">
        <div className="tabla-wrap">
          <table className="tabla">
            <thead>
              <tr>
                <th>Código</th>
                <th>Ruta</th>
                <th>Salida</th>
                <th>Días</th>
                <th>Activa</th>
              </tr>
            </thead>
            <tbody>
              {visibles.length === 0 && (
                <tr>
                  <td colSpan={5}>Todavía no hay frecuencias registradas.</td>
                </tr>
              )}
              {visibles.map((f) => (
                <tr key={f.id} className={f.activa ? '' : 'inactiva'}>
                  <td>
                    <b>{f.codigo}</b>
                    <small>{f.cooperativa}</small>
                  </td>
                  <td>
                    {f.ruta}
                    <small>Resolución {f.resolucion}</small>
                  </td>
                  <td>{f.hora_salida}</td>
                  <td>{textoDias(f.dias)}</td>
                  <td>
                    <button
                      type="button"
                      className={'switch' + (f.activa ? ' on' : '')}
                      onClick={() => alternar(f)}
                      aria-label={f.activa ? 'Desactivar frecuencia' : 'Activar frecuencia'}
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
          <h4>Nueva frecuencia</h4>

          {!esCoop && (
            <label>
              Cooperativa
              <select
                value={form.cooperativa_id}
                onChange={(e) =>
                  setForm({ ...form, cooperativa_id: e.target.value, ruta_id: '', resolucion_id: '' })
                }
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
            Código
            <input
              value={form.codigo}
              onChange={(e) => setForm({ ...form, codigo: e.target.value })}
              placeholder="UIO-AMB-0600"
              required
            />
          </label>

          <label>
            Ruta
            <select
              value={form.ruta_id}
              onChange={(e) => setForm({ ...form, ruta_id: e.target.value })}
              required
            >
              <option value="">Selecciona una ruta...</option>
              {rutasDeCoop.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>
          </label>

          <label>
            Resolución
            <select
              value={form.resolucion_id}
              onChange={(e) => setForm({ ...form, resolucion_id: e.target.value })}
              required
            >
              <option value="">Selecciona una resolución...</option>
              {resoluciones.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.numero} ({r.autoridad})
                </option>
              ))}
            </select>
          </label>

          <label>
            Hora de salida
            <input
              type="time"
              value={form.hora_salida}
              onChange={(e) => setForm({ ...form, hora_salida: e.target.value })}
              required
            />
          </label>

          <p><b>Días de operación</b></p>
          <p>
            {DIAS.map((d) => (
              <label key={d.n}>
                <input
                  type="checkbox"
                  checked={form.dias.includes(d.n)}
                  onChange={() => alternarDia(d.n)}
                />{' '}
                {d.corto}{' '}
              </label>
            ))}
          </p>

          <button className="btn btn-oscuro" disabled={form.dias.length === 0}>
            Registrar frecuencia
          </button>
        </form>
      </div>
    </div>
  )
}
