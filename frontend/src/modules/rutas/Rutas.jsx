import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import Dialogo from '../../components/ui/Dialogo'
import { rutasService } from './services/rutas.service'

const formularioVacio = () => ({ nombre: '', paradas: [{ terminal_id: '', minutos: '0' }, { terminal_id: '', minutos: '' }] })

export default function Rutas({ integrada = false }) {
  const { sesion, ejecutar } = useApp()
  const esGerente = sesion?.rol === 'cooperativa'
  const [rutas, setRutas] = useState([])
  const [terminales, setTerminales] = useState([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [errorFormulario, setErrorFormulario] = useState('')
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [form, setForm] = useState(formularioVacio)
  const Titulo = integrada ? 'h2' : 'h1'
  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [r, t] = await Promise.all([rutasService.listarRutas(), rutasService.listarTerminales()])
      setRutas(r); setTerminales(t); setError('')
    } catch (e) { setError(e.message) } finally { setCargando(false) }
  }, [sesion?.coopId])
  useEffect(() => { cargar() }, [cargar])
  const visibles = esGerente ? rutas.filter(r => r.cooperativa_id === sesion.coopId) : rutas
  const cambiarParada = (i, campo, valor) => setForm(f => ({ ...f, paradas: f.paradas.map((p, k) => k === i ? { ...p, [campo]: valor } : p) }))
  const cerrar = () => { if (!guardando) setMostrarFormulario(false) }
  async function guardar(e) {
    e.preventDefault()
    if (guardando || !esGerente) return
    setErrorFormulario(''); setGuardando(true)
    try {
      const entrada = { cooperativa_id: sesion.coopId, nombre: form.nombre.trim(), paradas: form.paradas.map((p, i) => ({ terminal_id: p.terminal_id, minutos_desde_origen: i === 0 ? 0 : Number(p.minutos) })) }
      const originales = rutas.find(r => r.id === form.id)
      const paradasIguales = originales && JSON.stringify(originales.paradas.map(p => [p.terminal_id, p.minutos_desde_origen])) === JSON.stringify(entrada.paradas.map(p => [p.terminal_id, p.minutos_desde_origen]))
      const resultado = await ejecutar(() => form.id ? rutasService.actualizarRuta(form.id, { nombre: entrada.nombre, ...(!paradasIguales ? { paradas: entrada.paradas } : {}) }) : rutasService.crearRuta(entrada), form.id ? 'Ruta actualizada.' : 'Ruta registrada. Ya puedes configurar sus frecuencias.')
      if (resultado.ok) { setMostrarFormulario(false); setForm(formularioVacio()); await cargar() }
      else setErrorFormulario(resultado.error?.message || 'No se pudo registrar la ruta.')
    } finally { setGuardando(false) }
  }
  async function alternar(ruta) {
    if (guardando) return
    setGuardando(true)
    try {
      const resultado = await ejecutar(() => rutasService.actualizarRuta(ruta.id, { activa: !ruta.activa }), ruta.activa ? 'Ruta desactivada.' : 'Ruta activada.')
      if (resultado.ok) await cargar()
    } finally { setGuardando(false) }
  }
  return <section className={integrada ? 'gestion-rutas' : 'contenedor gestion-rutas'}>
    <div className="seccion-cab izq">
      <Titulo>Rutas de {esGerente ? 'tu cooperativa' : 'las cooperativas'}</Titulo>
      <p>Selecciona las terminales del catálogo y define el origen, las paradas intermedias y el destino.</p>
      {esGerente && <div className="acciones">
        <button type="button" className="btn btn-oscuro" disabled={cargando || !terminales.length} onClick={() => { setForm(formularioVacio()); setErrorFormulario(''); setMostrarFormulario(true) }}>Nueva ruta</button>
        <Link className="btn btn-claro" to="/frecuencias">Frecuencias</Link>
        <Link className="btn btn-claro" to="/programacion">Programar viajes</Link>
      </div>}
    </div>
    {error && <p role="alert">{error} <button className="btn-link" onClick={cargar}>Reintentar</button></p>}
    {!cargando && !error && !terminales.length && <p role="status">El catálogo de ciudades y terminales todavía no está cargado. Solicita su carga al responsable de la base de datos.</p>}
    <div className="tabla-wrap"><table className="tabla">
      <thead><tr><th>Ruta</th><th>Recorrido</th><th>Duración estimada</th><th>Estado</th>{esGerente && <th>Acciones</th>}</tr></thead>
      <tbody>
        {cargando && <tr><td colSpan={esGerente ? 5 : 4}>Cargando rutas…</td></tr>}
        {!cargando && !visibles.length && <tr><td colSpan={esGerente ? 5 : 4}>Todavía no hay rutas registradas.</td></tr>}
        {!cargando && visibles.map(r => <tr key={r.id}>
          <td><b>{r.nombre}</b><small>{r.cooperativa}</small></td>
          <td>{r.paradas.map(p => p.ciudad).join(' → ')}<small>{r.paradas.length} paradas</small></td>
          <td>{r.paradas.at(-1)?.minutos_desde_origen || 0} min</td>
          <td><span className={'badge ' + (r.activa ? 'verde' : 'gris')}>{r.activa ? 'Activa' : 'Inactiva'}</span></td>
          {esGerente && <td><button className="btn btn-claro" disabled={guardando} onClick={() => { setForm({ id:r.id,nombre:r.nombre,paradas:r.paradas.map(p=>({terminal_id:p.terminal_id,minutos:String(p.minutos_desde_origen)})) });setErrorFormulario('');setMostrarFormulario(true) }}>Editar</button> <button className="btn btn-claro" disabled={guardando} onClick={() => alternar(r)}>{r.activa ? 'Desactivar' : 'Activar'}</button></td>}
        </tr>)}
      </tbody>
    </table></div>
    {esGerente && mostrarFormulario && <Dialogo overlayProps={{ onMouseDown: e => { if (e.target === e.currentTarget) cerrar() } }} panelProps={{ 'aria-labelledby': 'titulo-nueva-ruta' }}>
      <header className="modal-header"><div><h2 id="titulo-nueva-ruta">{form.id ? "Editar ruta" : "Nueva ruta"}</h2><p>Se registrará únicamente en tu cooperativa.</p></div><button className="btn btn-claro" type="button" aria-label="Cerrar" disabled={guardando} onClick={cerrar}>×</button></header>
      <form onSubmit={guardar}>
        {errorFormulario && <p role="alert" className="auth-aviso">{errorFormulario}</p>}
        <fieldset disabled={guardando} className="rutas-formulario">
          <label>Nombre de la ruta<input required maxLength={150} value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ambato - Latacunga - Quito" /></label>
          <p>Las ciudades y terminales ya están registradas en la base de datos. Los minutos son acumulados desde la salida.</p>
          {form.paradas.map((parada, i) => <section className="ruta-parada" key={i}>
            <strong>{i === 0 ? 'Origen' : i === form.paradas.length - 1 ? 'Destino' : 'Parada intermedia ' + i}</strong>
            <label>Ciudad y terminal<select required value={parada.terminal_id} onChange={e => cambiarParada(i, 'terminal_id', e.target.value)}>
              <option value="">Selecciona una terminal…</option>
              {terminales.map(t => <option key={t.id} value={t.id} disabled={form.paradas.some((p, j) => j !== i && p.terminal_id === t.id)}>{t.ciudades.nombre} · {t.nombre}</option>)}
            </select></label>
            <label>Minutos desde el origen<input type="number" required min={i ? Number(form.paradas[i - 1].minutos || 0) + 1 : 0} step="1" disabled={i === 0} value={i === 0 ? '0' : parada.minutos} onChange={e => cambiarParada(i, 'minutos', e.target.value)} /></label>
            {i > 0 && form.paradas.length > 2 && <button type="button" className="btn-link rojo" onClick={() => setForm(f => ({ ...f, paradas: f.paradas.filter((_, j) => j !== i) }))}>Quitar parada</button>}
          </section>)}
          <button type="button" className="btn btn-claro" onClick={() => setForm(f => ({ ...f, paradas: [...f.paradas.slice(0, -1), { terminal_id: '', minutos: '' }, f.paradas.at(-1)] }))}>Agregar parada intermedia</button>
        </fieldset>
        <footer className="modal-footer"><button type="button" className="btn btn-claro" disabled={guardando} onClick={cerrar}>Cancelar</button><button type="submit" className="btn btn-oscuro" disabled={guardando}>{guardando ? 'Guardando…' : form.id ? 'Guardar cambios' : 'Registrar ruta'}</button></footer>
      </form>
    </Dialogo>}
  </section>
}
