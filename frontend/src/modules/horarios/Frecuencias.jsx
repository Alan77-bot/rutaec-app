import { Link } from 'react-router-dom'
import Dialogo from '../../components/ui/Dialogo'
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

export default function Frecuencias({ integrada = false, onTotalChange }) {
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
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const Titulo = integrada ? 'h2' : 'h1'

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

  useEffect(() => { onTotalChange?.(visibles.length) }, [visibles.length, onTotalChange])

  const alternarDia = (n) =>
    setForm((f) => ({
      ...f,
      dias: f.dias.includes(n) ? f.dias.filter((d) => d !== n) : [...f.dias, n],
    }))

  const guardar = async (e) => {
    e.preventDefault()
    if (guardando) return
    setGuardando(true)
    const entrada = {
      ...(esCoop ? {} : { cooperativa_id: form.cooperativa_id }),
      codigo: form.codigo.trim(),
      ruta_id: form.ruta_id,
      resolucion_id: form.resolucion_id,
      hora_salida: form.hora_salida,
      dias: [...form.dias].sort((a, b) => a - b),
    }
    const r = await ejecutar(
      () => form.id ? horariosService.actualizarFrecuencia(form.id, entrada) : horariosService.crearFrecuencia(entrada),
      'Frecuencia registrada.'
    )
    setGuardando(false)
    if (r.ok) {
      setMostrarFormulario(false)
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
    <div className={integrada ? "gestion-frecuencias" : "contenedor gestion-frecuencias"}>
      <div className="seccion-cab izq">
        <Titulo>Frecuencias</Titulo>
        <p>Horas de salida y días de operación de las rutas registradas en tu cooperativa.</p>
        <div className="acciones"><button type="button" className="btn btn-oscuro" onClick={() => { setForm(formVacio()); setMostrarFormulario(true) }}>Nueva frecuencia</button><Link className="btn btn-claro" to="/rutas">Gestionar rutas</Link></div>
      </div>

      {error && <p role="alert">{error}</p>}

      <div>
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
                      disabled={guardando}
                      aria-label={f.activa ? 'Desactivar frecuencia' : 'Activar frecuencia'}
                    >
                      <i />
                    </button>
                    <button className="btn btn-claro" onClick={() => { setForm({ ...f }); setMostrarFormulario(true) }}>Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <section className="panel" style={{ marginTop: 20 }}><p>Las frecuencias utilizan una ruta existente y una resolución registrada.</p>
          {esCoop && !rutasDeCoop.length && <p role="status">Primero crea o activa una ruta de tu cooperativa en la pestaña Rutas.</p>}
          {form.cooperativa_id && !resoluciones.length && <p role="status">Registra primero el documento en la pestaña Resoluciones del panel de tu cooperativa.</p>}
        </section>
        {mostrarFormulario && <Dialogo overlayProps={{ onMouseDown: e => { if (e.target === e.currentTarget && !guardando) setMostrarFormulario(false) } }} panelProps={{ 'aria-labelledby': 'titulo-nueva-frecuencia' }}>
        <header className="modal-header"><div><h2 id="titulo-nueva-frecuencia">{form.id ? "Editar frecuencia" : "Nueva frecuencia"}</h2><p>Selecciona una ruta y su resolución.</p></div><button type="button" aria-label="Cerrar" disabled={guardando} onClick={() => setMostrarFormulario(false)}>×</button></header>
        <form onSubmit={guardar}><fieldset disabled={guardando} className="rutas-formulario">

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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
            {DIAS.map((d) => (
              <label key={d.n} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, margin: 0 }}>
                <input
                  type="checkbox"
                  checked={form.dias.includes(d.n)}
                  onChange={() => alternarDia(d.n)}
                />{' '}
                {d.corto}
              </label>
            ))}
          </div>

          <button className="btn btn-oscuro" disabled={guardando || form.dias.length === 0 || !rutasDeCoop.length || !resoluciones.length}>
            {guardando ? 'Guardando…' : form.id ? 'Guardar cambios' : 'Registrar frecuencia'}
          </button>
          <button className="btn btn-claro" type="button" disabled={guardando} onClick={() => setMostrarFormulario(false)}>Cancelar</button>
        </fieldset></form></Dialogo>}
      </div>
    </div>
  )
}
