import TarjetaDemo from './TarjetaDemo'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

export default function PresentarPago() {
  const { compraId } = useParams()
  const nav = useNavigate()
  const [info, setInfo] = useState(null)
  const [plazos,setPlazos] = useState([])
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [metodo, setMetodo] = useState('DEPOSITO')
  const [recibido,setRecibido]=useState(''),[confirmado,setConfirmado]=useState(false)
  const [cuenta, setCuenta] = useState('')
  const [referencia, setReferencia] = useState('')
  const [fecha, setFecha] = useState('')
  const [importe, setImporte] = useState('')
  const [archivo, setArchivo] = useState(null)
  const clave = useRef(crypto.randomUUID())
  useEffect(() => {
    const control = new AbortController()
    fetch(`/api/pagos/cuentas/${compraId}`, { credentials: 'include', signal: control.signal }).then(async r => {
      const b = await r.json(); if (!r.ok) throw new Error(b.error ?? 'No se pudo consultar el pago.'); return b.datos
    }).then(d => { setInfo(d); setCuenta(d.cuentas[0]?.id ?? ''); setImporte(String(d.compra.total));setMetodo(d.ventanilla && !d.pagos.some(p => p.estado === 'CORRECCION')?'EFECTIVO':'TRANSFERENCIA') }).catch(e => { if (e.name !== 'AbortError') setError(e.message) })
    fetch(`/api/pagos/revisiones/plazos/${compraId}`,{credentials:'include',signal:control.signal}).then(r=>r.ok?r.json():{datos:[]}).then(b=>setPlazos(b.datos)).catch(()=>{})
    return () => control.abort()
  }, [compraId])
  const correccion = info?.pagos.find(p => p.estado === 'CORRECCION')
  async function enviar(e) {
    e.preventDefault(); if (ocupado) return
    if (metodo === 'EFECTIVO' && !correccion) {
      setOcupado(true);setError('');
      try{const r=await fetch('/api/ventas/efectivo',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({compraId,claveIdempotencia:clave.current,recibido,confirmado})});const b=await r.json();if(!r.ok)throw new Error(b.error);nav(`/reserva/${compraId}`,{replace:true})}catch(e){setError(e.message)}finally{setOcupado(false)}
      return
    }
    if (!archivo || archivo.size > 5 * 1024 * 1024 || !['image/jpeg','image/png','application/pdf'].includes(archivo.type)) { setError('Selecciona JPG, PNG o PDF de hasta 5 MB.'); return }
    setOcupado(true); setError('')
    try {
      const datos = new FormData()
      for (const [key, value] of Object.entries({ compra_id: compraId, metodo, cuenta_bancaria_id: cuenta, clave_idempotencia: clave.current, numero_referencia: referencia, fecha_operacion: fecha, importe_declarado: importe })) datos.append(key, value)
      datos.append('archivo', archivo)
      if(info.ventanilla && confirmado && !correccion) datos.append('confirmado','true')
      const ruta = correccion ? `/api/pagos/revisiones/pagos/${correccion.id}/corregir` : info.ventanilla ? '/api/ventas/comprobante' : '/api/pagos'
      const r = await fetch(ruta, { method: 'POST', credentials: 'include', body: datos }); const b = await r.json()
      if (!r.ok) throw new Error(b.error ?? 'No se pudo recibir el comprobante.')
      nav(`/reserva/${compraId}`, { replace: true })
    } catch (e) { setError(e.message) } finally { setOcupado(false) }
  }
  const c = info?.cuentas.find(x => x.id === cuenta)
  const correccionVencida = !!correccion && plazos.some(p=>p.correccionVenceEn && new Date(p.correccionVenceEn)<=new Date())
  const admite = info && !correccionVencida && (correccion || (info.compra.estado === 'RESERVADA' && new Date(info.compra.vence_en) > new Date()))
  return <div className="contenedor"><h1>{correccion ? 'Corregir comprobante' : 'Presentar pago'}</h1><Link to={`/reserva/${compraId}`}>Volver a la reserva</Link>
    {error && <p role="alert" className="auth-aviso">{error}</p>}
    {!info ? <p role="status">Cargando…</p> : <section className="panel"><p>Total de la compra: {info.compra.moneda} {info.compra.total}</p>

      {correccion && <p role="status">Corrección solicitada: {correccion.motivo}. El archivo anterior se conservará.</p>}
      {plazos.filter(p=>p.correccionVenceEn).map(p=><p key={p.id}>Plazo de corrección: {new Date(p.correccionVenceEn).toLocaleString('es-EC',{timeZone:'America/Guayaquil'})}</p>)}
      {correccionVencida&&<p>El plazo de corrección terminó. Continúa por la incidencia del pago.</p>}
      {!admite ? <p>La reserva ya no admite pagos en su estado actual.</p> : <>
        {!correccion && <label>Método de pago<select value={metodo} onChange={e=>{setMetodo(e.target.value);setConfirmado(false)}} disabled={ocupado}>{info.ventanilla&&<option value="EFECTIVO">Efectivo en ventanilla</option>}<option value="TRANSFERENCIA">Transferencia</option><option value="DEPOSITO">Depósito</option><option value="TARJETA">Tarjeta (prueba sin cobro)</option></select></label>}
        {metodo==='TARJETA' ? info.tarjeta.habilitada ? <TarjetaDemo compraId={compraId}/> : <p>Tarjeta de prueba deshabilitada en este entorno.</p> : <form className="auth-campos" onSubmit={enviar}>
          {metodo==='EFECTIVO' && !correccion ? <><label>Efectivo recibido<input type="number" min={Number(info.compra.total)} step="0.01" required value={recibido} onChange={e=>setRecibido(e.target.value)}/></label><p>Cambio: USD {Math.max(0,Number(recibido)-Number(info.compra.total)).toFixed(2)}</p><label><input type="checkbox" required checked={confirmado} onChange={e=>setConfirmado(e.target.checked)}/>Confirmo que recibí el efectivo del comprador.</label><p className="muted">No se requiere archivo. Se generarán boleto con QR y comprobante de venta no fiscal.</p></> : <>
            {correccion ? <p>Se conservan el método y la cuenta del pago original.</p> : <><label>Cuenta receptora<select required value={cuenta} onChange={e=>setCuenta(e.target.value)} disabled={ocupado}>{info.cuentas.map(a=><option key={a.id} value={a.id}>{a.banco} · {a.numero} · {a.titular}</option>)}</select></label>
            {!c&&<p>No hay cuentas receptoras habilitadas.</p>}</>}
            <label>Referencia bancaria<input required minLength={3} maxLength={40} value={referencia} onChange={e=>setReferencia(e.target.value)}/></label><label>Fecha de operación<input type="date" required value={fecha} onChange={e=>setFecha(e.target.value)}/></label><label>Importe<input type="number" min="0.01" step="0.01" required value={importe} onChange={e=>setImporte(e.target.value)}/></label><label>Comprobante<input type="file" required accept="image/jpeg,image/png,application/pdf" onChange={e=>setArchivo(e.target.files?.[0]||null)}/></label>
            {info.ventanilla && !correccion?<label><input type="checkbox" required checked={confirmado} onChange={e=>setConfirmado(e.target.checked)}/>He contrastado este importe y referencia con la cuenta bancaria. Confirmar venta al registrar.</label>:<p>El boleto se emitirá cuando el oficinista confirme el pago.</p>}
          </>}
          <button className="btn btn-oscuro" disabled={ocupado||(!correccion&&(metodo==='EFECTIVO'?!confirmado:!c))}>{ocupado?'Procesando…':correccion?'Enviar corrección para revisión':metodo==='EFECTIVO'||info.ventanilla?'Confirmar pago y generar documentos':'Enviar pago para revisión'}</button>
        </form>}
      </>}

    </section>}
  </div>
}
