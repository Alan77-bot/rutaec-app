import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../../context/AppContext'

export default function CorreoLocal() {
  const { sesion } = useApp()
  const [correo,setCorreo] = useState(sesion?.correo || ''), [clave,setClave] = useState(''), [lista,setLista] = useState(null), [error,setError] = useState(''), [ocupado,setOcupado] = useState(false)
  async function consultar(e) {
    e.preventDefault(); setOcupado(true); setError('')
    try { const r=await fetch('/api/correo-local',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({correo,clave})});const b=await r.json();if(!r.ok)throw new Error(b.error||'No se pudo consultar.');setLista(b.datos) } catch(e) { setError(e.message) } finally { setOcupado(false) }
  }
  return <div className="contenedor"><h1>Correo local de desarrollo</h1><p>Esta bandeja sustituye el envío externo cuando no hay SMTP. Solo puedes consultar los mensajes de tu propia cuenta y no está disponible en producción.</p><Link to="/ingresar">Volver al acceso</Link>
    <form className="panel auth-campos" onSubmit={consultar}><label>Correo<input type="email" required autoComplete="username" value={correo} onChange={e=>setCorreo(e.target.value)}/></label><label>Contraseña de tu cuenta<input type="password" required autoComplete="current-password" value={clave} onChange={e=>setClave(e.target.value)}/></label><button className="btn btn-oscuro" disabled={ocupado}>{ocupado?'Consultando…':'Consultar mensajes'}</button></form>
    {error&&<p role="alert">{error}</p>}{lista?.length===0&&<p>No hay mensajes. Solicita el registro, reenvío o recuperación desde la aplicación.</p>}
    {lista?.map(c=><article key={c.id} className="panel"><h2>{c.asunto}</h2><p>{new Date(c.creado_en).toLocaleString('es-EC')}</p><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{c.texto}</pre></article>)}
  </div>
}
