import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

export default function DetalleReserva() {
  const { id } = useParams()
  const [compra, setCompra] = useState(null)
  const [error, setError] = useState('')
  const [ahora, setAhora] = useState(Date.now())
  const [offset, setOffset] = useState(0)
  const [motivo, setMotivo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [version, setVersion] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    async function cargar() {
      try {
        const r = await fetch(`/api/reservas/compras/${id}`, { credentials: 'include', signal: controller.signal }); const b = await r.json()
        if (!r.ok) throw new Error(b.error ?? 'No se pudo cargar la reserva.')
        setCompra(b.datos); setOffset(new Date(b.datos.ahora).getTime() - Date.now()); setError('')
      } catch (e) { if (e.name !== 'AbortError') setError(e.message) }
    }
    cargar(); const intervalo = setInterval(cargar, 8000)
    return () => { controller.abort(); clearInterval(intervalo) }
  }, [id, version])
  useEffect(() => { const timer = setInterval(() => setAhora(Date.now()), 1000); return () => clearInterval(timer) }, [])
  async function cancelar(e) {
    e.preventDefault(); if (ocupado) return; setOcupado(true)
    try {
      const r = await fetch(`/api/reservas/compras/${id}/cancelar`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ motivo }) }); const b = await r.json()
      if (!r.ok) throw new Error(b.error ?? 'No se pudo cancelar.')
      setCompra(b.datos)
    } catch (e) { setError(e.message) } finally { setOcupado(false) }
  }
  const segundos = Math.max(0, Math.ceil((new Date(compra?.vence_en).getTime() - ahora - offset) / 1000))
  const vigente = compra?.estado === 'RESERVADA' && segundos > 0
  return <div className="contenedor"><h1>Detalle de reserva</h1><Link to="/mis-reservas">Mis reservas</Link>
    {error && <p role="alert">{error}</p>}
    <button className="btn btn-claro" onClick={() => setVersion(v => v + 1)}>Actualizar</button>
    {!compra ? <p role="status">Cargando…</p> : <>
      <section className="panel"><h2>{compra.cooperativas.nombre_comercial}</h2><p>Código: {compra.id}</p><p>Estado: {compra.estado}</p>
        {compra.estado === 'RESERVADA' && <p role="status">{vigente ? `Tiempo para presentar pago: ${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2,'0')}` : 'El plazo de reserva terminó. Actualizando el estado…'}</p>}
        <p>Total: {compra.moneda} {compra.total}</p>
        <p><Link to={`/incidencias?compraId=${id}`}>Solicitar cancelación, devolución o informar un pago tardío</Link></p>
        {compra.pagos.some(p => p.estado === 'APROBADO') && <p><a href={`/api/boletos/recibos/${id}`} target="_blank" rel="noreferrer">Descargar recibo del pago</a></p>}
        {compra.detalle_compra.map(d => <p key={d.id}>{d.pasajero_snapshot.nombres} {d.pasajero_snapshot.apellidos} · asiento {d.asiento_snapshot.numero} · tarifa {d.precio_base} − descuento {d.descuento} = {d.importe}</p>)}
        {compra.motivo && <p>{compra.motivo}</p>}
        {vigente && <Link className="btn btn-acento" to={`/pagar/${id}`}>Presentar pago</Link>}
        {compra.estado === 'EN_REVISION' && <p>Pago en revisión. Tu asiento permanece apartado; aquí aparecerá la decisión o la solicitud de corrección.</p>}
        {compra.pagos.map(p => <p key={p.id}>Pago {p.metodo}: {p.estado} {p.motivo && `· ${p.motivo}`}{p.estado === 'CORRECCION' && <Link to={`/pagar/${id}`}> Corregir comprobante</Link>}</p>)}
        {compra.boletos.map(b => <p key={b.id}><Link to={`/boleto/${b.id}`}>Boleto {b.codigo.slice(0,8)}</Link></p>)}
      </section>
      {['RESERVADA','VENCIDA'].includes(compra.estado) && !compra.pagos.length && <form className="panel" onSubmit={cancelar}><label>Motivo de cancelación<input required maxLength={500} value={motivo} onChange={e => setMotivo(e.target.value)} /></label><button className="btn btn-claro" disabled={ocupado}>Cancelar reserva sin pago</button></form>}
    </>}
  </div>
}
