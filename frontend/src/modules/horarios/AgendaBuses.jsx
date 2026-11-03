import { useEffect, useState } from 'react'

export default function AgendaBuses(){
  const [datos,setDatos]=useState(null),[error,setError]=useState(''),[mensaje,setMensaje]=useState(''),[ocupado,setOcupado]=useState(false)
  const [form,setForm]=useState({busId:'',tipo:'DESCANSO',inicio:'',fin:'',motivo:''})
  const [liberar,setLiberar]=useState(null),[razon,setRazon]=useState('')
  async function cargar(signal){const r=await fetch('/api/horarios/operacion/agenda',{credentials:'include',signal});const b=await r.json();if(!r.ok)throw new Error(b.error??'No se pudo consultar la agenda.');setDatos(b.datos)}
  useEffect(()=>{const c=new AbortController();cargar(c.signal).catch(e=>{if(e.name!=='AbortError')setError(e.message)});return()=>c.abort()},[])
  async function guardar(e){e.preventDefault();if(ocupado)return;setOcupado(true);setError('');setMensaje('');try{
    const ruta=liberar?`/${liberar.id}/liberar`:''
    const body=liberar?{motivo:razon}:{...form,inicio:new Date(form.inicio+'-05:00').toISOString(),fin:new Date(form.fin+'-05:00').toISOString()}
    const r=await fetch('/api/horarios/operacion/agenda'+ruta,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const b=await r.json();if(!r.ok)throw new Error(b.error??'No se pudo guardar. El horario puede cruzarse con otra operación.');setMensaje(b.mensaje);setLiberar(null);await cargar()
  }catch(e){setError(e.message)}finally{setOcupado(false)}}
  const campo=(k,v)=>setForm(f=>({...f,[k]:v}))
  return <section className="panel"><h2>Descansos y mantenimiento</h2><p>Horas de Ecuador continental (UTC−5). Los bloqueos se respetan al programar viajes.</p>
    {error&&<p role="alert">{error}</p>}{mensaje&&<p role="status">{mensaje}</p>}
    {!datos?<p>Cargando agenda…</p>:<>
      <form className="auth-campos" onSubmit={guardar}>{liberar?<><p>Liberar {liberar.tipo}: {liberar.bus_id}</p><label>Motivo<input required minLength={5} maxLength={500} value={razon} onChange={e=>setRazon(e.target.value)}/></label></>:<>
        <label>Bus<select required value={form.busId} onChange={e=>campo('busId',e.target.value)}><option value="">Seleccionar bus</option>{datos.buses.map(b=><option key={b.id} value={b.id}>{b.placa}</option>)}</select></label>
        <label>Tipo<select value={form.tipo} onChange={e=>campo('tipo',e.target.value)}><option value="DESCANSO">Descanso</option><option value="MANTENIMIENTO">Mantenimiento</option></select></label>
        <label>Inicio<input type="datetime-local" required value={form.inicio} onChange={e=>campo('inicio',e.target.value)}/></label><label>Fin<input type="datetime-local" required value={form.fin} onChange={e=>campo('fin',e.target.value)}/></label><label>Motivo<input required minLength={5} maxLength={500} value={form.motivo} onChange={e=>campo('motivo',e.target.value)}/></label>
      </>}<button className="btn btn-oscuro" disabled={ocupado}>{liberar?'Confirmar liberación':'Guardar bloqueo'}</button>{liberar&&<button type="button" className="btn btn-claro" onClick={()=>setLiberar(null)}>Volver</button>}</form>
      {datos.agenda.length===0&&<p>No hay bloqueos vigentes.</p>}{datos.agenda.map(a=><article key={a.id}><p>{datos.buses.find(b=>b.id===a.bus_id)?.placa} · {a.tipo} · {new Date(a.inicio).toLocaleString('es-EC',{timeZone:'America/Guayaquil'})} — {new Date(a.fin).toLocaleString('es-EC',{timeZone:'America/Guayaquil'})}</p><p>{a.motivo}</p><button className="btn btn-claro" disabled={ocupado} onClick={()=>{setLiberar(a);setRazon('')}}>Liberar con motivo</button></article>)}
    </>}
  </section>
}
