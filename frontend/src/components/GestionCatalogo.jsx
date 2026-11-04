import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import Dialogo from './ui/Dialogo'

const fechaActual = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil' }).format(new Date())
const esquemas = {
  terminales: { titulo: 'Terminales', singular: 'terminal', campos: [['ciudad_id','Ciudad','ciudad'],['nombre','Nombre de la terminal','text'],['direccion','Dirección','text']], inicial: () => ({}) },
  grupos: { titulo: 'Grupos de buses', singular: 'grupo', campos: [['nombre','Nombre','text'],['tipo','Tipo','select',['LARGA_DISTANCIA','CANTONAL','LOCAL']],['activo','Activo','checkbox']], inicial: () => ({tipo:'LARGA_DISTANCIA',activo:true}) },
  resoluciones: { titulo: 'Resoluciones', singular: 'resolución', campos: [
    ['numero','Número','text'],['autoridad','Autoridad emisora','text'],['fecha_emision','Fecha de emisión','date'],['vigente_desde','Vigente desde','date'],['vigente_hasta','Vigente hasta (opcional)','date',true],
  ], inicial: () => ({ autoridad: 'ANT', fecha_emision: fechaActual(), vigente_desde: fechaActual(), vigente_hasta: '' }) },
  cuentas: { titulo: 'Cuentas bancarias', singular: 'cuenta', campos: [
    ['banco','Banco','text'],['tipo','Tipo de cuenta','select',['AHORROS','CORRIENTE']],['numero','Número de cuenta','text'],['titular','Titular','text'],['activa','Activa','checkbox'],
  ], inicial: () => ({ tipo: 'AHORROS', activa: true }) },
  politicas: { titulo: 'Políticas de descuento', singular: 'política', campos: [
    ['codigo','Código','text'],['version','Versión','number'],['descripcion','Descripción','text'],['porcentaje','Porcentaje','number'],['edad_minima','Edad mínima (opcional)','number',true],['edad_maxima','Edad máxima (opcional)','number',true],['documento_requerido','Documento requerido','text'],['fuente_normativa','Fuente o referencia de la política','text'],['vigente_desde','Vigente desde','date'],['vigente_hasta','Vigente hasta (opcional)','date',true],['activa','Activa','checkbox'],
  ], inicial: () => ({ version: 1, porcentaje: '', edad_minima: '', edad_maxima: '', documento_requerido: 'CEDULA', vigente_desde: fechaActual(), vigente_hasta: '', activa: true }) },
}
async function pedir(ruta, opciones = {}) {
  const r = await fetch(ruta, { credentials: 'include', ...opciones })
  const b = await r.json()
  if (!r.ok) throw new Error(b.error || 'No se pudo completar la operación.')
  return b
}
export default function GestionCatalogo({ recurso }) {
  const { sesion } = useApp()
  const esquema = esquemas[recurso]
  const [lista, setLista] = useState([]), [cooperativas, setCooperativas] = useState([])
  const [error, setError] = useState(''), [mensaje, setMensaje] = useState(''), [errorModal, setErrorModal] = useState('')
  const [cargando, setCargando] = useState(true), [guardando, setGuardando] = useState(false), [version, setVersion] = useState(0)
  const [edicion, setEdicion] = useState(null)
  const [ciudades, setCiudades] = useState([])
  const admin = sesion?.rol === 'admin', necesitaCoop = ['resoluciones','cuentas','grupos'].includes(recurso)
  useEffect(() => {
    const c = new AbortController(); setCargando(true); setError('')
    Promise.all([pedir('/api/gestion/' + recurso, { signal: c.signal }), admin && necesitaCoop ? pedir('/api/cooperativas', { signal: c.signal }) : Promise.resolve({ datos: [] }), recurso === 'terminales' ? pedir('/api/rutas/ciudades', {signal:c.signal}) : Promise.resolve({datos:[]})])
      .then(([b, coops, catalogo]) => { setCiudades(catalogo.datos); setLista(b.datos); setCooperativas(coops.datos.filter(c => c.activa)) })
      .catch(e => { if (!c.signal.aborted) setError(e.message) }).finally(() => { if (!c.signal.aborted) setCargando(false) })
    return () => c.abort()
  }, [recurso, version, admin, necesitaCoop])
  const abrir = fila => {
    const datos = { ...Object.fromEntries(esquema.campos.map(([campo,,tipo]) => [campo, tipo === 'checkbox' ? true : ''])), ...esquema.inicial(), ...(fila || {}), cooperativa_id: fila?.cooperativa_id || sesion.coopId || '' }
    for (const [campo,,tipo] of esquema.campos) if (tipo === 'date') datos[campo] = datos[campo]?.slice(0,10) || ''
    setEdicion(datos); setErrorModal(''); setMensaje('')
  }
  const cerrar = () => { if (!guardando) setEdicion(null) }
  async function guardar(e) {
    e.preventDefault(); if (guardando) return; setGuardando(true); setErrorModal('')
    try {
      const datos = Object.fromEntries(esquema.campos.map(([campo]) => [campo, edicion[campo] ?? '']))
      if (necesitaCoop) datos.cooperativa_id = edicion.cooperativa_id
      await pedir('/api/gestion/' + recurso + (edicion.id ? '/' + edicion.id : ''), { method: edicion.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) })
      setEdicion(null); setMensaje('Registro guardado correctamente.'); setVersion(v => v + 1)
    } catch (e) { setErrorModal(e.message) } finally { setGuardando(false) }
  }
  return <section>
    <div className="seccion-cab izq"><h2>{esquema.titulo}</h2></div>
    <button className="btn btn-oscuro" onClick={() => abrir(null)}>Registrar {esquema.singular}</button>
    {error && <p role="alert">{error} <button className="btn-link" onClick={() => setVersion(v => v + 1)}>Reintentar</button></p>}
    {mensaje && <p role="status">{mensaje}</p>}
    <div className="tabla-wrap" style={{ marginTop: 20, overflowX: 'auto' }}><table><thead><tr>
      {esquema.campos.map(([campo,titulo]) => <th key={campo}>{titulo.replace(' (opcional)','')}</th>)}<th>Acciones</th>
    </tr></thead><tbody>
      {cargando ? <tr><td colSpan={esquema.campos.length + 1}>Cargando…</td></tr> : !lista.length ? <tr><td colSpan={esquema.campos.length + 1}>No hay registros.</td></tr> : lista.map(fila => <tr key={fila.id}>{esquema.campos.map(([campo,,tipo]) => <td key={campo}>{tipo === 'checkbox' ? (fila[campo] ? 'Sí' : 'No') : tipo === 'ciudad' ? (fila.ciudades?.nombre || '—') : tipo === 'date' ? (fila[campo]?.slice(0,10) || 'Sin límite') : String(fila[campo] ?? '—')}</td>)}<td><button className="btn btn-claro" onClick={() => abrir(fila)}>Editar</button></td></tr>)}
    </tbody></table></div>
    {edicion && <Dialogo overlayProps={{ onMouseDown: e => { if (e.target === e.currentTarget) cerrar() } }} panelProps={{ 'aria-labelledby': 'titulo-catalogo' }}>
      <header className="modal-header"><h2 id="titulo-catalogo">{edicion.id ? 'Editar' : 'Registrar'} {esquema.singular}</h2><button aria-label="Cerrar" disabled={guardando} onClick={cerrar}>×</button></header>
      <form onSubmit={guardar}>{errorModal && <p role="alert" className="auth-aviso">{errorModal}</p>}
        <fieldset className="rutas-formulario" disabled={guardando}>
          {admin && necesitaCoop && <label>Cooperativa<select required disabled={!!edicion.id} value={edicion.cooperativa_id} onChange={e => setEdicion({ ...edicion, cooperativa_id: e.target.value })}><option value="">Selecciona…</option>{cooperativas.map(c => <option value={c.id} key={c.id}>{c.nombre_comercial}</option>)}</select></label>}
          {esquema.campos.map(([campo,titulo,tipo,extra]) => <label key={campo}>{titulo}
            {tipo === 'ciudad' ? <select required value={edicion[campo]} onChange={e => setEdicion({...edicion,[campo]:e.target.value})}><option value="">Selecciona una ciudad…</option>{ciudades.map(c => <option key={c.id} value={c.id}>{c.nombre} · {c.provincia}</option>)}</select> : tipo === 'select' ? <select value={edicion[campo]} onChange={e => setEdicion({ ...edicion, [campo]: e.target.value })}>{extra.map(v => <option key={v}>{v}</option>)}</select> : tipo === 'checkbox' ? <input type="checkbox" checked={!!edicion[campo]} onChange={e => setEdicion({ ...edicion, [campo]: e.target.checked })} /> : <input type={tipo} required={!extra} maxLength={200} step={campo === 'porcentaje' ? '.01' : '1'} min={campo === 'version' ? '1' : tipo === 'number' ? '0' : undefined} value={edicion[campo] ?? ''} onChange={e => setEdicion({ ...edicion, [campo]: e.target.value })} />}
          </label>)}
        </fieldset><footer className="modal-footer"><button type="button" className="btn btn-claro" disabled={guardando} onClick={cerrar}>Cancelar</button><button className="btn btn-oscuro" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button></footer>
      </form>
    </Dialogo>}
  </section>
}
