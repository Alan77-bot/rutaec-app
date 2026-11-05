import { useState } from 'react'

export default function SolicitudDescuentoPasajero({ pasajero, cooperativaId, politicas, onActualizar }) {
  const [abierto,setAbierto]=useState(false),[politica,setPolitica]=useState(''),[archivo,setArchivo]=useState(null)
  const [hasta,setHasta]=useState(''),[ocupado,setOcupado]=useState(false),[mensaje,setMensaje]=useState(''),[error,setError]=useState('')
  async function solicitar(){
    if(ocupado)return;setOcupado(true);setError('')
    try{
      if(!archivo||!politica||!hasta)throw new Error('Selecciona el tipo, la vigencia y el documento.');
      const datos={nombres:pasajero.nombres,apellidos:pasajero.apellidos,documento:pasajero.documento,tipoDocumento:pasajero.tipoDocumento,paisDocumento:pasajero.paisDocumento,fechaNacimiento:pasajero.fechaNacimiento,cooperativaId,politicaId:politica,validoHasta:hasta}
      const body=new FormData();Object.entries(datos).forEach(([k,v])=>body.append(k,v));body.append('archivo',archivo)
      const r=await fetch('/api/reservas/descuentos/solicitar',{method:'POST',credentials:'include',body});const b=await r.json();if(!r.ok)throw new Error(b.error)
      setMensaje('Solicitud enviada. Actualiza las validaciones después de que el oficinista la revise.');onActualizar()
    }catch(e){setError(e.message)}finally{setOcupado(false)}
  }
  return <section className="solicitud-descuento"><button type="button" className="btn btn-claro" aria-expanded={abierto} onClick={()=>setAbierto(v=>!v)}>{abierto?'Cerrar solicitud':'Aplicar a descuento'}</button>
    {abierto&&<div className="auth-campos"><label>Tipo de descuento<select value={politica} onChange={e=>setPolitica(e.target.value)}><option value="">Selecciona…</option>{politicas.map(p=><option value={p.id} key={p.id}>{p.descripcion} · {p.porcentaje}%</option>)}</select></label>{!politicas.length&&<p>No hay políticas activas y vigentes configuradas por el administrador.</p>}<label>Documento válido hasta<input type="date" value={hasta} onChange={e=>setHasta(e.target.value)}/></label><label>Documento del pasajero<input type="file" accept="image/png,image/jpeg,application/pdf" onChange={e=>setArchivo(e.target.files?.[0]||null)}/></label><button type="button" className="btn btn-oscuro" disabled={ocupado||!politicas.length} onClick={solicitar}>{ocupado?'Enviando…':'Solicitar validación'}</button>{error&&<p role="alert">{error}</p>}{mensaje&&<p role="status">{mensaje}</p>}</div>}
  </section>
}
