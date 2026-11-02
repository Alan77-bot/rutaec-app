import { useState } from 'react'
import { Link } from 'react-router-dom'

export default function CancelacionViajes() {
  const hoy=new Date().toLocaleDateString('en-CA',{timeZone:'America/Guayaquil'})
  const [desde,setDesde]=useState(hoy),[hasta,setHasta]=useState(hoy),[lista,setLista]=useState(null)
  const [elegido,setElegido]=useState(null),[motivo,setMotivo]=useState(''),[acepto,setAcepto]=useState(false)
  const [ocupado,setOcupado]=useState(false),[error,setError]=useState(''),[mensaje,setMensaje]=useState('')
  async function cargar() {
    const r=await fetch(`/api/horarios/cancelaciones/viajes?${new URLSearchParams({desde,hasta})}`,{credentials:'include'})
    const b=await r.json();if(!r.ok)throw new Error(b.error??'No se pudo consultar.');setLista(b.datos)
  }
  async function buscar(e){e.preventDefault();setOcupado(true);setError('');try{await cargar()}catch(e){setError(e.message)}finally{setOcupado(false)}}
  async function cancelar(e){e.preventDefault();if(!acepto||ocupado)return;setOcupado(true);setError('');try{
    const r=await fetch(`/api/horarios/cancelaciones/viajes/${elegido.id}`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({motivo})});const b=await r.json();if(!r.ok)throw new Error(b.error??'No se pudo cancelar.');setMensaje(b.mensaje);setElegido(null);await cargar()
  }catch(e){setError(e.message)}finally{setOcupado(false)}}
  return <div className="contenedor"><h1>Cancelación de viajes</h1><Link to="/programacion">Programación</Link>
    <p>Se detienen las ventas, se anulan los boletos y se avisa a los compradores. Los pagos se conservan y se tramitan manualmente como incidencias. Esta pantalla no devuelve dinero.</p>
    {error&&<p role="alert">{error}</p>}{mensaje&&<p role="status">{mensaje}</p>}
    <form className="panel auth-campos" onSubmit={buscar}><label>Desde<input type="date" required value={desde} onChange={e=>setDesde(e.target.value)}/></label><label>Hasta<input type="date" required value={hasta} onChange={e=>setHasta(e.target.value)}/></label><button className="btn btn-oscuro" disabled={ocupado}>Consultar viajes</button></form>
    {lista?.length===0&&<p>No hay viajes en ese período.</p>}
    {lista?.map(v=><article className="panel" key={v.id}><h2>{v.cooperativas.nombre_comercial}</h2><p>Salida: {new Date(v.agenda_bus.inicio).toLocaleString('es-EC',{timeZone:'America/Guayaquil'})} · {v.estado}</p><p>Viaje: {v.id} · Compras registradas: {v._count.compras}</p>{v.motivo_cancelacion&&<p>{v.motivo_cancelacion}</p>}{v.estado!=='CANCELADO'&&<button className="btn btn-claro" disabled={ocupado} onClick={()=>{setElegido(v);setMotivo('');setAcepto(false)}}>Preparar cancelación</button>}</article>)}
    {elegido&&<form className="panel auth-campos" onSubmit={cancelar}><h2>Cancelar viaje {elegido.id}</h2><label>Motivo<textarea required minLength={5} maxLength={500} value={motivo} onChange={e=>setMotivo(e.target.value)}/></label><label><input type="checkbox" required checked={acepto} onChange={e=>setAcepto(e.target.checked)}/>Confirmo la cancelación y la atención de los pasajeros afectados.</label><button className="btn btn-oscuro" disabled={ocupado||!acepto}>Confirmar cancelación</button><button type="button" className="btn btn-claro" disabled={ocupado} onClick={()=>setElegido(null)}>Volver</button></form>}
  </div>
}
