import TarjetaDemo from './TarjetaDemo'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

export default function PresentarPago() {
  const { compraId } = useParams()
  const nav = useNavigate()
  const [info, setInfo] = useState(null)
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [metodo, setMetodo] = useState('DEPOSITO')
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
    }).then(d => { setInfo(d); setCuenta(d.cuentas[0]?.id ?? ''); setImporte(String(d.compra.total)) }).catch(e => { if (e.name !== 'AbortError') setError(e.message) })
    return () => control.abort()
  }, [compraId])
  const correccion = info?.pagos.find(p => p.estado === 'CORRECCION')
  async function enviar(e) {
    e.preventDefault(); if (ocupado) return
    if (!archivo || archivo.size > 5 * 1024 * 1024 || !['image/jpeg','image/png','application/pdf'].includes(archivo.type)) { setError('Selecciona JPG, PNG o PDF de hasta 5 MB.'); return }
    setOcupado(true); setError('')
    try {
      const datos = new FormData()
      for (const [key, value] of Object.entries({ compra_id: compraId, metodo, cuenta_bancaria_id: cuenta, clave_idempotencia: clave.current, numero_referencia: referencia, fecha_operacion: fecha, importe_declarado: importe })) datos.append(key, value)
      datos.append('archivo', archivo)
      const ruta = correccion ? `/api/pagos/revisiones/pagos/${correccion.id}/corregir` : '/api/pagos'
      const r = await fetch(ruta, { method: 'POST', credentials: 'include', body: datos }); const b = await r.json()
      if (!r.ok) throw new Error(b.error ?? 'No se pudo recibir el comprobante.')
      nav(`/reserva/${compraId}`, { replace: true })
    } catch (e) { setError(e.message) } finally { setOcupado(false) }
  }
  const c = info?.cuentas.find(x => x.id === cuenta)
  const admite = info && (correccion || (info.compra.estado === 'RESERVADA' && new Date(info.compra.vence_en) > new Date()))
  return <div className="contenedor"><h1>{correccion ? 'Corregir comprobante' : 'Presentar pago'}</h1><Link to={`/reserva/${compraId}`}>Volver a la reserva</Link>
    {error && <p role="alert" className="auth-aviso">{error}</p>}
    {!info ? <p role="status">Cargando…</p> : <section className="panel"><p>Total de la compra: {info.compra.moneda} {info.compra.total}</p>
      {admite && !correccion && info.tarjeta.habilitada && <TarjetaDemo compraId={compraId} />}
      {correccion && <p role="status">Corrección solicitada: {correccion.motivo}. El archivo anterior se conservará.</p>}
      {!admite ? <p>Esta compra ya no admite un comprobante en su estado actual. Actualiza su detalle.</p> : <form className="auth-campos" onSubmit={enviar}>
        <label>Método<select value={metodo} onChange={e => setMetodo(e.target.value)} disabled={ocupado || !!correccion}><option value="DEPOSITO">Depósito</option><option value="TRANSFERENCIA">Transferencia</option></select></label>
        <p className="muted">Tarjeta: {info.tarjeta.mensaje}</p>
        <label>Cuenta receptora<select required value={cuenta} onChange={e => setCuenta(e.target.value)} disabled={ocupado || !!correccion}>{info.cuentas.map(a => <option value={a.id} key={a.id}>{a.banco} · {a.tipo} · {a.numero}</option>)}</select></label>
        {c && <p>Banco: {c.banco} · Titular: {c.titular} · Cuenta: {c.numero}</p>}
        {!c && <p>La cooperativa todavía no tiene una cuenta bancaria habilitada. No puedes presentar el pago.</p>}
        <label>Referencia bancaria<input required minLength={3} maxLength={40} value={referencia} onChange={e => setReferencia(e.target.value)} /></label>
        <label>Fecha de operación<input type="date" required value={fecha} onChange={e => setFecha(e.target.value)} /></label>
        <label>Importe declarado<input type="number" min="0.01" step="0.01" required value={importe} onChange={e => setImporte(e.target.value)} /></label>
        <label>Comprobante<input type="file" required accept="image/jpeg,image/png,application/pdf" onChange={e => setArchivo(e.target.files?.[0] ?? null)} /></label>
        <p>Subir el comprobante no confirma el ingreso. Un oficinista contrastará la referencia y el importe con la cuenta bancaria.</p>
        <button className="btn btn-acento" disabled={ocupado || !c}>{ocupado ? 'Enviando…' : 'Enviar comprobante'}</button>
      </form>}
    </section>}
  </div>
}
