import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'

export default function CrearReserva({ pasajeros, viajeId, origen, destino, cooperativaId }) {
  const nav = useNavigate()
  const { sesion } = useApp()
  const [compradorId, setCompradorId] = useState(() => sesion?.rol === 'oficinista' ? sessionStorage.getItem('rutaec:comprador-ventanilla') ?? '' : '')
  const clave = useRef(crypto.randomUUID())
  const [datos, setDatos] = useState(() => pasajeros.map(p => ({ asientoId: p.asientoId, nombres: p.nombre, apellidos: '', documento: p.cedula.toUpperCase(), tipoDocumento:p.tipoDocumento??'CEDULA', paisDocumento:p.paisDocumento??'EC', fechaNacimiento: '', validacionId: '' })))
  const [validaciones, setValidaciones] = useState([])
  useEffect(() => {
    const c = new AbortController()
    fetch('/api/reservas/descuentos/mios' + (compradorId ? `?compradorId=${encodeURIComponent(compradorId)}` : ''), { credentials:'include',signal:c.signal }).then(r=>r.ok?r.json():{datos:[]}).then(b=>setValidaciones(b.datos??[])).catch(()=>{})
    return ()=>c.abort()
  }, [compradorId])
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const cambiar = (i, campo, valor) => setDatos(lista => lista.map((p, n) => n === i ? { ...p, [campo]: valor } : p))
  async function guardar(e) {
    e.preventDefault(); if (ocupado) return; setOcupado(true); setError('')
    try {
      const r = await fetch('/api/reservas/compras', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ viajeId, origen, destino, pasajeros: datos, compradorId: compradorId || undefined, claveIdempotencia: clave.current }) })
      const cuerpo = await r.json()
      if (!r.ok) throw new Error(cuerpo.error ?? 'No se pudo crear la reserva.')
      nav(`/reserva/${cuerpo.datos.id}`, { replace: true })
    } catch (e) { setError(e.message) } finally { setOcupado(false) }
  }
  return <form className="auth-campos" onSubmit={guardar}>
    <h3>Confirmar reserva</h3>
    <p>Al confirmar, tendrás cinco minutos para presentar el pago. El importe definitivo lo calcula el servidor con la tarifa vigente. No se aplican descuentos sin validación aprobada.</p>
    {error && <p role="alert" className="auth-aviso">{error}</p>}
    {sesion?.rol === 'oficinista' && <label>Cuenta del comprador (ventanilla)<input required value={compradorId} onChange={e => setCompradorId(e.target.value)} /></label>}
    {datos.map((p, i) => <fieldset key={p.asientoId} className="pasajero" disabled={ocupado}>
      <legend>Pasajero {i + 1}</legend>
      <label>Nombres<input required maxLength={100} value={p.nombres} onChange={e => cambiar(i, 'nombres', e.target.value)} /></label>
      <label>Apellidos<input required maxLength={100} value={p.apellidos} onChange={e => cambiar(i, 'apellidos', e.target.value)} /></label>
      <label>Tipo de documento<select value={p.tipoDocumento} onChange={e=>cambiar(i,'tipoDocumento',e.target.value)}><option value="CEDULA">Cédula ecuatoriana</option><option value="PASAPORTE">Pasaporte</option></select></label>
      {p.tipoDocumento==='PASAPORTE'&&<label>País emisor (código de dos letras)<input required pattern="[A-Z]{2}" maxLength={2} value={p.paisDocumento} onChange={e=>cambiar(i,'paisDocumento',e.target.value.toUpperCase())}/></label>}
      <label>Número de documento<input required inputMode={p.tipoDocumento==='CEDULA'?'numeric':'text'} pattern={p.tipoDocumento==='CEDULA'?'[0-9]{10}':'[A-Za-z0-9]{4,20}'} maxLength={p.tipoDocumento==='CEDULA'?10:20} value={p.documento} onChange={e => cambiar(i, 'documento', e.target.value)} /></label>
      <label>Fecha de nacimiento<input type="date" required value={p.fechaNacimiento} onChange={e => cambiar(i, 'fechaNacimiento', e.target.value)} /></label>
      <label>Descuento aprobado<select value={p.validacionId} onChange={e => cambiar(i, "validacionId", e.target.value)}><option value="">Tarifa normal (sin descuento)</option>{validaciones.filter(v=>v.estado==="APROBADA"&&v.cooperativa_id===cooperativaId&&v.pasajeros.numero_documento===p.documento.toUpperCase()&&v.pasajeros.tipo_documento===p.tipoDocumento&&v.pasajeros.pais_documento===p.paisDocumento).map(v=><option key={v.id} value={v.id}>{v.politicas_descuento.descripcion}</option>)}</select></label>
    </fieldset>)}
    {datos.some(p => !p.validacionId) && <label><input type="checkbox" required /> Acepto la tarifa normal para los pasajeros sin descuento aprobado. Puedo solicitar la validación documental antes de reservar.</label>}
    <button className="btn btn-acento btn-lg" disabled={ocupado}>{ocupado ? 'Reservando…' : 'Reservar por cinco minutos'}</button>
  </form>
}
