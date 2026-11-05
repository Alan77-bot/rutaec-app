import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import Dialogo from '../../components/ui/Dialogo'
import { horariosService } from './services/horarios.service'
import { rutasService } from '../rutas/services/rutas.service'
import AgendaBuses from './AgendaBuses'
import Viajes from './Viajes'

const fecha = (offset = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil' }).format(new Date(Date.now() + offset * 86400000))
async function pedir(ruta, opciones = {}) { const r = await fetch(ruta, { credentials:'include', ...opciones }); const b = await r.json(); if (!r.ok) throw new Error(b.error || 'No se pudo consultar la planificación.'); return b.datos }
export default function HojaRuta() {
  const { sesion } = useApp()
  const [desde, setDesde] = useState(fecha()), [hasta, setHasta] = useState(fecha(7))
  const [datos, setDatos] = useState(null), [frecuencias, setFrecuencias] = useState([]), [rutas, setRutas] = useState([])
  const [error, setError] = useState(''), [version, setVersion] = useState(0), [modal, setModal] = useState(false), [manual, setManual] = useState(false)
  const [agendaAbierta, setAgendaAbierta] = useState(false)
  const [ocupado, setOcupado] = useState(false), [resultado, setResultado] = useState(null)
  const [form, setForm] = useState({ frecuencia_id:'', bus_ids:[], desde:fecha(1), hasta:fecha(7), fuente_normativa:'', minutos_cierre:'60', tarifas:{} })
  useEffect(() => {
    const c = new AbortController(); setError('')
    Promise.all([pedir('/api/horarios/planificacion?' + new URLSearchParams({ desde,hasta }), { signal:c.signal }), horariosService.listarFrecuencias(), rutasService.listarRutas()])
      .then(([d,f,r]) => { if (!c.signal.aborted) { setDatos(d); setFrecuencias(f.filter(x => x.cooperativa_id === sesion.coopId && x.activa)); setRutas(r) } })
      .catch(e => { if (!c.signal.aborted) setError(e.message) })
    return () => c.abort()
  }, [desde,hasta,version,sesion.coopId])
  const dias = useMemo(() => {
    const inicio = Date.parse(desde + 'T12:00:00Z'), fin = Date.parse(hasta + 'T12:00:00Z'), lista=[]
    for (let d=inicio; d<=fin && lista.length<31; d+=86400000) lista.push(new Date(d).toISOString().slice(0,10))
    return lista
  }, [desde,hasta])
  const frecuencia = frecuencias.find(f => f.id === form.frecuencia_id), ruta = rutas.find(r => r.id === frecuencia?.ruta_id)
  const tramos = ruta ? ruta.paradas.flatMap(o => ruta.paradas.filter(d => d.orden > o.orden && o.permite_subida && d.permite_bajada).map(d => ({ o:o.orden,d:d.orden,nombre:o.ciudad+' → '+d.ciudad }))) : []
  const busesDisponibles = datos?.buses.filter(b => b.estado === 'ACTIVO' && b.asientos_activos === b.capacidad) || []
  const vip = busesDisponibles.some(b => form.bus_ids.includes(b.id) && b.asientos_vip > 0)
  const cerrar = () => { if (!ocupado) setModal(false) }
  async function generar(e) {
    e.preventDefault(); if (ocupado) return; setOcupado(true); setError(''); setResultado(null)
    try {
      const tarifas = tramos.map(t => ({ origen_orden:t.o,destino_orden:t.d,normal:Number(form.tarifas[t.o+'-'+t.d]?.normal),vip:vip ? Number(form.tarifas[t.o+'-'+t.d]?.vip) : null }))
      const salida = await pedir('/api/horarios/planificacion/rotar', { method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ ...form,minutos_cierre:Number(form.minutos_cierre),tarifas }) })
      setResultado(salida); setModal(false); setDesde(form.desde); setHasta(form.hasta); setVersion(v=>v+1)
    } catch(e) { setError(e.message) } finally { setOcupado(false) }
  }
  return <section>
    <h2>Hoja de ruta</h2><p>Asignaciones reales por bus y día. Los buses sin viaje quedan como parada; los descansos y mantenimientos bloquean nuevas asignaciones.</p>
    <div className="acciones"><button className="btn btn-claro" onClick={() => setAgendaAbierta(v => !v)}>{agendaAbierta ? 'Volver a la hoja de ruta' : 'Mantenimiento y descansos'}</button></div>
    {agendaAbierta ? <section className="panel"><AgendaBuses /><button className="btn btn-claro" onClick={() => {setAgendaAbierta(false);setVersion(v=>v+1)}}>Cerrar y actualizar hoja</button></section> : <>
    <div className="acciones"><label>Desde<input type="date" value={desde} onChange={e=>setDesde(e.target.value)} /></label><label>Hasta<input type="date" value={hasta} onChange={e=>setHasta(e.target.value)} /></label>
      <button className="btn btn-claro" onClick={()=>setVersion(v=>v+1)}>Actualizar hoja</button><button className="btn btn-oscuro" onClick={()=>{setError('');setModal(true)}}>Generar con rotación</button><button className="btn btn-claro" onClick={()=>setManual(v=>!v)}>{manual?'Ocultar programación':'Programación manual'}</button>
    </div>
    {error && <p role="alert" className="auth-aviso">{error}</p>}
    {resultado && <div role="status" className="panel"><p>{resultado.creados.length} viajes publicados; {resultado.omitidos.length} fechas omitidas.</p>{resultado.omitidos.map((o,i)=><p key={i}>{o.fecha}: {o.motivo}</p>)}</div>}
    {!datos ? <p>Cargando hoja…</p> : <div className="tabla-wrap" style={{overflowX:'auto',marginTop:20}}><table><thead><tr><th>Bus</th>{dias.map(d=><th key={d}>{d}</th>)}</tr></thead><tbody>
      {datos.buses.length===0 && <tr><td colSpan={dias.length+1}>Primero registra un bus y su distribución.</td></tr>}
      {datos.buses.map(bus=><tr key={bus.id}><td><strong>{bus.numero_unidad}</strong><small>{bus.placa}</small></td>{dias.map(d=>{
        const viajes=datos.viajes.filter(v=>v.bus.placa===bus.placa&&v.fecha===d&&v.estado!=='CANCELADO')
        const bloqueos=datos.agenda.filter(a=>a.bus_id===bus.id&&new Date(a.inicio)<new Date(d+'T23:59:59-05:00')&&new Date(a.fin)>new Date(d+'T00:00:00-05:00'))
        return <td key={d} style={{minWidth:180}}>{viajes.map(v=><p key={v.id}><b>{v.salida} · {v.frecuencia}</b><br/>{v.ruta}<br/><small>{v.estado}</small></p>)}{bloqueos.map(a=><p key={a.id}>{a.tipo}<br/><small>{a.motivo}</small></p>)}{!viajes.length&&!bloqueos.length&&<small>{bus.estado==='ACTIVO'?'Parada: sin viaje asignado':bus.estado}</small>}</td>
      })}</tr>)}
    </tbody></table></div>}
    {manual && <Viajes integrada />}
    </> }
    {modal && <Dialogo overlayProps={{onMouseDown:e=>{if(e.target===e.currentTarget)cerrar()}}} panelProps={{'aria-labelledby':'rotacion-titulo'}}>
      <header className="modal-header"><div><h2 id="rotacion-titulo">Generación con rotación</h2><p>Distribuye los días de una frecuencia entre los buses seleccionados y respeta sus bloqueos.</p></div><button aria-label="Cerrar" disabled={ocupado} onClick={cerrar}>×</button></header>
      {error&&<p role="alert">{error}</p>}
      <form onSubmit={generar}><fieldset disabled={ocupado} className="rutas-formulario">
        <label>Frecuencia<select required value={form.frecuencia_id} onChange={e=>setForm({...form,frecuencia_id:e.target.value,tarifas:{}})}><option value="">Selecciona…</option>{frecuencias.map(f=><option value={f.id} key={f.id}>{f.codigo} · {f.ruta} · {f.hora_salida}</option>)}</select></label>
        {!frecuencias.length&&<p>Registra una resolución y una frecuencia activa antes de generar.</p>}
        <strong>Buses elegibles (en orden de rotación)</strong>{busesDisponibles.map(b=><label key={b.id}><span><input type="checkbox" checked={form.bus_ids.includes(b.id)} onChange={e=>setForm({...form,bus_ids:e.target.checked?[...form.bus_ids,b.id]:form.bus_ids.filter(id=>id!==b.id)})}/> {b.numero_unidad} · {b.placa} · {b.asientos_vip} VIP</span></label>)}
        {!busesDisponibles.length&&<p>No hay buses activos con distribución completa.</p>}
        <label>Desde<input type="date" required min={fecha()} value={form.desde} onChange={e=>setForm({...form,desde:e.target.value})}/></label><label>Hasta<input type="date" required min={form.desde} value={form.hasta} onChange={e=>setForm({...form,hasta:e.target.value})}/></label>
        <label>Minutos de cierre antes de salir<input type="number" required min="0" max="1440" value={form.minutos_cierre} onChange={e=>setForm({...form,minutos_cierre:e.target.value})}/></label>
        <label>Fuente de tarifas<input required minLength={3} maxLength={200} value={form.fuente_normativa} onChange={e=>setForm({...form,fuente_normativa:e.target.value})}/></label>
        {tramos.map(t=><section className="ruta-parada" key={t.o+'-'+t.d}><strong>{t.nombre}</strong>{['normal',...(vip?['vip']:[])].map(c=><label key={c}>Tarifa {c.toUpperCase()}<input type="number" required min="0.01" step="0.01" max="1000" value={form.tarifas[t.o+'-'+t.d]?.[c]||''} onChange={e=>setForm({...form,tarifas:{...form.tarifas,[t.o+'-'+t.d]:{...form.tarifas[t.o+'-'+t.d],[c]:e.target.value}}})}/></label>)}</section>)}
      </fieldset><footer className="modal-footer"><button type="button" className="btn btn-claro" disabled={ocupado} onClick={cerrar}>Cancelar</button><button className="btn btn-oscuro" disabled={ocupado||!form.bus_ids.length||!tramos.length}>{ocupado?'Generando…':'Generar y publicar'}</button></footer></form>
    </Dialogo>}
  </section>
}
