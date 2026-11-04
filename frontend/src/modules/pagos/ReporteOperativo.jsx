import { Link } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { useEffect, useState } from 'react'

function Tabla({titulo,filas}){
  const columnas=Object.keys(filas?.[0]??{})
  function exportar(){
    const celda=v=>{const texto=String(v??'');return '"'+(/^[=+@\-\t\r]/.test(texto)?"'"+texto:texto).replaceAll('"','""')+'"'}
    const contenido='\uFEFF'+[columnas,...filas.map(f=>columnas.map(c=>f[c]))].map(f=>f.map(celda).join(';')).join('\r\n')
    const url=URL.createObjectURL(new Blob([contenido],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=titulo.toLowerCase().replaceAll(' ','-')+'.csv';a.click();URL.revokeObjectURL(url)
  }
  return <section className="panel"><h2>{titulo}</h2>{!filas?.length?<p>Sin registros en el período.</p>:<><button className="btn btn-claro" onClick={exportar}>Exportar CSV</button><div style={{overflowX:'auto'}}><table><thead><tr>{columnas.map(c=><th key={c} scope="col">{c.replaceAll('_',' ')}</th>)}</tr></thead><tbody>{filas.map((f,i)=><tr key={i}>{columnas.map(c=><td key={c}>{typeof f[c]==='boolean'?(f[c]?'Sí':'No'):String(f[c]??'')}</td>)}</tr>)}</tbody></table></div></>}</section>
}
export default function ReporteOperativo(){
  const {sesion}=useApp()
  const [cooperativas,setCooperativas]=useState([]),[cooperativaId,setCooperativaId]=useState('')
  useEffect(()=>{if(sesion?.rol!=='admin')return;const c=new AbortController();fetch('/api/cooperativas',{credentials:'include',signal:c.signal}).then(r=>{if(!r.ok)throw new Error('No se pudieron cargar las cooperativas.');return r.json()}).then(b=>setCooperativas(b.datos)).catch(e=>{if(!c.signal.aborted)setError(e.message)});return()=>c.abort()},[sesion?.rol])
  const hoy=new Date().toLocaleDateString('en-CA',{timeZone:'America/Guayaquil'})
  const [desde,setDesde]=useState(hoy),[hasta,setHasta]=useState(hoy),[datos,setDatos]=useState(null),[error,setError]=useState(''),[ocupado,setOcupado]=useState(false)
  async function consultar(e){e.preventDefault();if(ocupado)return;setOcupado(true);setError('');try{const r=await fetch('/api/reportes-operativos?'+new URLSearchParams({desde,hasta,...(sesion?.rol==='admin'&&cooperativaId?{cooperativaId}:{})}),{credentials:'include'});const b=await r.json();if(!r.ok)throw new Error(b.error??'No se pudo consultar.');setDatos(b.datos)}catch(e){setError(e.message)}finally{setOcupado(false)}}
  return <div className="contenedor"><h1>Reporte operativo</h1><p><Link to="/revisiones">Bandeja de revisiones</Link></p>{['admin','cooperativa'].includes(sesion?.rol)&&<p><Link to="/rutas">Rutas</Link> · <Link to="/frecuencias">Frecuencias</Link> · <Link to="/programacion">Programación y tarifas</Link> · <Link to="/cancelacion-viajes">Agenda y cancelaciones</Link></p>}<p>{sesion?.rol === 'admin' ? 'Datos de todas las cooperativas o de la seleccionada.' : 'Datos de tu cooperativa.'} Las reservas pendientes y los pagos de demostración no se consideran ingresos. Fechas de Ecuador continental.</p>
    <form className="panel auth-campos" onSubmit={consultar}>{sesion?.rol==='admin'&&<label>Cooperativa<select value={cooperativaId} onChange={e=>setCooperativaId(e.target.value)}><option value="">Todas las cooperativas</option>{cooperativas.map(c=><option key={c.id} value={c.id}>{c.nombre_comercial}</option>)}</select></label>}<label>Desde<input type="date" required value={desde} onChange={e=>setDesde(e.target.value)}/></label><label>Hasta<input type="date" required value={hasta} onChange={e=>setHasta(e.target.value)}/></label><button className="btn btn-oscuro" disabled={ocupado}>{ocupado?'Consultando…':'Generar reporte'}</button></form>
    {error&&<p role="alert">{error}</p>}
    {datos&&<><p>Período consultado: {datos.periodo.desde} — {datos.periodo.hasta}. Los ingresos y devoluciones se agrupan por fecha efectiva; los demás trámites, por fecha de creación. La ocupación corresponde a la salida del viaje.</p><section className="panel"><h2>Movimientos efectivos</h2><p>Cobrado: USD {datos.ingresos[0]?.cobrado??'0'}</p><p>Devuelto: USD {datos.devuelto[0]?.devuelto??'0'}</p><p>Los cobros con incidencia están incluidos como dinero recibido y deben conciliarse.</p></section>
      <Tabla titulo="Reservas y compras" filas={datos.compras}/><Tabla titulo="Pagos por método y estado" filas={datos.pagos}/><Tabla titulo="Devoluciones" filas={datos.devoluciones}/><Tabla titulo="Revisiones y tiempos" filas={datos.revisiones}/><Tabla titulo="Viajes" filas={datos.viajes}/><Tabla titulo="Ocupación por tramo" filas={datos.ocupacion}/><p>La ocupación muestra hasta 1000 tramos. Reduce el período si alcanzas ese límite.</p>
    </>}
  </div>
}
