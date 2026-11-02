import { useEffect, useState } from 'react'

export default function Descuentos() {
  const [politicas, setPoliticas] = useState([])
  const [coops, setCoops] = useState([])
  const [lista, setLista] = useState(null)
  const [form, setForm] = useState({ nombres:'', apellidos:'', documento:'', fechaNacimiento:'', cooperativaId:'', politicaId:'', validoHasta:'' })
  const [archivo, setArchivo] = useState(null)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [version, setVersion] = useState(0)
  useEffect(() => {
    const control=new AbortController()
    async function get(url) {const r=await fetch(url,{credentials:'include',signal:control.signal});const b=await r.json();if(!r.ok)throw new Error(b.error??'No se pudo consultar.');return b.datos}
    Promise.all([get('/api/reservas/descuentos/politicas'),get('/api/cooperativas'),get('/api/reservas/descuentos/mios')]).then(([p,c,l])=>{setPoliticas(p);setCoops(c);setLista(l)}).catch(e=>{if(e.name!=='AbortError')setError(e.message)})
    return()=>control.abort()
  },[version])
  const campo=(nombre,valor)=>setForm(f=>({...f,[nombre]:valor}))
  async function enviar(e){
    e.preventDefault();if(ocupado)return;setOcupado(true);setError('');setMensaje('')
    try{
      if(!archivo||archivo.size>5*1024*1024)throw new Error('Adjunta un documento de hasta 5 MB.')
      const body=new FormData();Object.entries(form).forEach(([k,v])=>body.append(k,v));body.append('archivo',archivo)
      const r=await fetch('/api/reservas/descuentos/solicitar',{method:'POST',credentials:'include',body});const b=await r.json();if(!r.ok)throw new Error(b.error??'No se pudo enviar.')
      setMensaje(b.mensaje);setVersion(v=>v+1)
    }catch(e){setError(e.message)}finally{setOcupado(false)}
  }
  return <div className="contenedor"><h1>Validación de descuentos</h1><p>Solicita la revisión antes de reservar. No se aparta ningún asiento mientras se revisan tus documentos. Subir una fotografía no aprueba el descuento.</p>
    {error&&<p role="alert" className="auth-aviso">{error}</p>}{mensaje&&<p role="status">{mensaje}</p>}
    <div className="dos-col"><section className="panel"><h2>Nueva solicitud</h2>
      {politicas.length===0&&<p>No hay políticas habilitadas. La cooperativa debe confirmar edades, porcentaje y vigencia antes de recibir solicitudes.</p>}
      <form className="auth-campos" onSubmit={enviar}><label>Nombres<input required maxLength={100} value={form.nombres} onChange={e=>campo('nombres',e.target.value)}/></label><label>Apellidos<input required maxLength={100} value={form.apellidos} onChange={e=>campo('apellidos',e.target.value)}/></label><label>Cédula<input required pattern="[0-9]{10}" maxLength={10} inputMode="numeric" value={form.documento} onChange={e=>campo('documento',e.target.value)}/></label><label>Nacimiento<input type="date" required value={form.fechaNacimiento} onChange={e=>campo('fechaNacimiento',e.target.value)}/></label>
        <label>Cooperativa<select required value={form.cooperativaId} onChange={e=>campo('cooperativaId',e.target.value)}><option value="">Selecciona</option>{coops.map(c=><option key={c.id} value={c.id}>{c.nombre_comercial}</option>)}</select></label>
        <label>Política<select required value={form.politicaId} onChange={e=>campo('politicaId',e.target.value)}><option value="">Selecciona</option>{politicas.map(p=><option key={p.id} value={p.id}>{p.descripcion} · {p.porcentaje}%</option>)}</select></label>
        <label>Vigencia solicitada hasta<input type="date" required value={form.validoHasta} onChange={e=>campo('validoHasta',e.target.value)}/><small>El oficinista debe comprobarla contra el documento y la política.</small></label>
        <label>Documento legible (JPG, PNG o PDF)<input type="file" required accept="image/jpeg,image/png,application/pdf" onChange={e=>setArchivo(e.target.files?.[0]??null)}/></label>
        <button className="btn btn-acento" disabled={ocupado||!politicas.length}>{ocupado?'Enviando…':'Enviar para revisión'}</button>
      </form>
    </section><section className="panel"><h2>Mis solicitudes</h2><button className="btn btn-claro" onClick={()=>setVersion(v=>v+1)}>Actualizar</button>
      {lista===null&&<p>Cargando…</p>}{lista?.length===0&&<p>No tienes solicitudes.</p>}
      {lista?.map(v=><article key={v.id}><h3>{v.pasajeros.nombres} {v.pasajeros.apellidos}</h3><p>{v.politicas_descuento.descripcion} · {v.estado}</p><p>Vigencia: {v.valido_desde.slice(0,10)} a {v.valido_hasta.slice(0,10)}</p>{v.motivo&&<p>Motivo: {v.motivo}</p>}<a target="_blank" rel="noreferrer" href={`/api/reservas/descuentos/documentos/${v.documento_id}`}>Mi documento</a></article>)}
    </section></div>
  </div>
}
