import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function TarjetaDemo({ compraId }) {
  const nav = useNavigate()
  const clave = useRef(crypto.randomUUID())
  const [datos, setDatos] = useState({ numero:'', titular:'', vencimiento:'', codigoSeguridad:'', resultado:'APROBADO' })
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  async function pagar(e) {
    e.preventDefault(); if (ocupado) return; setOcupado(true); setError('')
    try {
      const r = await fetch('/api/pagos/tarjeta-demo',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({...datos,compraId,claveIdempotencia:clave.current})}); const b = await r.json()
      if(!r.ok) throw new Error(b.error ?? 'No se pudo procesar.')
      if(b.estado === 'APROBADO') { setDatos({numero:'',titular:'',vencimiento:'',codigoSeguridad:'',resultado:'APROBADO'}); nav(`/reserva/${compraId}`,{replace:true}) }
      else { clave.current=crypto.randomUUID(); setError(b.mensaje) }
    }catch(e){setError(e.message)}finally{setOcupado(false)}
  }
  return <form className="auth-campos" onSubmit={pagar}><h3>Tarjeta de demostración — SIN COBRO REAL</h3><p>Usa datos de prueba, nunca una tarjeta real. No se consulta la existencia de la tarjeta ni se almacena su número o código de seguridad.</p>
    {error && <p role="alert">{error}</p>}
    <label>Nombre de prueba<input required maxLength={100} value={datos.titular} onChange={e=>setDatos({...datos,titular:e.target.value})}/></label>
    <label>Número de prueba<input required inputMode="numeric" pattern="[0-9]{13,19}" maxLength={19} autoComplete="off" value={datos.numero} onChange={e=>setDatos({...datos,numero:e.target.value})}/></label>
    <label>Vencimiento MM/AA<input required pattern="(0[1-9]|1[0-2])/[0-9]{2}" maxLength={5} autoComplete="off" value={datos.vencimiento} onChange={e=>setDatos({...datos,vencimiento:e.target.value})}/></label>
    <label>Código de prueba<input type="password" required inputMode="numeric" pattern="[0-9]{3,4}" maxLength={4} autoComplete="off" value={datos.codigoSeguridad} onChange={e=>setDatos({...datos,codigoSeguridad:e.target.value})}/></label>
    <label>Escenario<select value={datos.resultado} onChange={e=>setDatos({...datos,resultado:e.target.value})}><option value="APROBADO">Aprobación simulada</option><option value="RECHAZADO">Rechazo simulado</option></select></label>
    <button className="btn btn-acento" disabled={ocupado}>{ocupado?'Procesando…':'Simular pago, sin cobro'}</button>
  </form>
}
