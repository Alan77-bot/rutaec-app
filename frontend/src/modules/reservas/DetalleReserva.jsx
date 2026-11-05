import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

export default function DetalleReserva() {
  const { id } = useParams()
  const [compra, setCompra] = useState(null)
  const [plazos,setPlazos] = useState([])
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
  useEffect(() => {
    const control=new AbortController()
    async function cargar(){try{const r=await fetch(`/api/pagos/revisiones/plazos/${id}`,{credentials:'include',signal:control.signal});if(r.ok){const b=await r.json();setPlazos(b.datos)}}catch{/* El detalle de compra sigue disponible. */}}
    cargar();const timer=setInterval(cargar,8000)
    return()=>{control.abort();clearInterval(timer)}
  },[id,version])
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
  const pagada=compra?.estado==='CONFIRMADA' && compra.pagos.some(p=>p.estado==='APROBADO')
  const pasajeros=compra?.detalle_compra||[]
  return <div className="contenedor detalle-reserva-mejorado"><div className="cabecera-acciones"><div><span className="ui-eyebrow">RESERVA #{id.slice(0,8).toUpperCase()}</span><h1>{compra?.cooperativas.nombre_comercial||'Detalle de reserva'}</h1></div><div className="acciones"><Link className="btn btn-claro" to="/mis-reservas">Mis reservas</Link><button className="btn btn-claro" disabled={ocupado} onClick={()=>setVersion(v=>v+1)}>Actualizar</button></div></div>
    {error&&<p className="auth-aviso" role="alert">{error}</p>}
    {!compra?<p role="status">Cargando reserva…</p>:<>
      <section className="panel reserva-cabecera"><div><span className={'badge '+(pagada?'verde':'gris')}>{compra.estado.replaceAll('_',' ')}</span><h2>{compra.recorrido?.[0]?.nombre_snapshot} → {compra.recorrido?.at(-1)?.nombre_snapshot}</h2><p>{compra.recorrido?.[0]?.salida&&new Date(compra.recorrido[0].salida).toLocaleString('es-EC',{timeZone:'America/Guayaquil'})}</p><small>{compra.canal==='VENTANILLA'?'Venta en ventanilla':'Compra en línea'}</small></div><div><small>Total</small><strong className="reserva-importe">{compra.moneda} {Number(compra.total).toFixed(2)}</strong></div></section>
      {compra.comprador_presencial&&<section className="panel"><h3>Comprador</h3><p>{compra.comprador_presencial.nombres} {compra.comprador_presencial.apellidos} · {compra.comprador_presencial.documento}</p>{compra.comprador_presencial.correo&&<p>{compra.comprador_presencial.correo}</p>}</section>}
      {compra.estado==='RESERVADA'&&<section className="panel reserva-pendiente" role="status"><strong>{vigente?`Reserva vigente · ${Math.floor(segundos/60)}:${String(segundos%60).padStart(2,'0')}`:'La reserva venció'}</strong>{vigente&&<Link className="btn btn-oscuro" to={`/pagar/${id}`}>Continuar al pago</Link>}</section>}
      {compra.estado==='EN_REVISION'&&<p className="auth-aviso" role="status">Pago en revisión. El boleto aparecerá después de su aprobación.</p>}
      <h2>Pasajeros y asientos</h2><div className="reservas-grid">{pasajeros.map(d=><article className="panel reserva-tarjeta" key={d.id}><div className="cabecera-acciones"><h3>{d.pasajero_snapshot.nombres} {d.pasajero_snapshot.apellidos}</h3><span className="badge">Asiento {d.asiento_snapshot.numero}</span></div><p>Documento: {d.pasajero_snapshot.numero_documento||d.pasajero_snapshot.documento}</p><p>Piso {d.asiento_snapshot.piso} · {d.asiento_snapshot.categoria}{d.asiento_snapshot.preferencial?' · Preferencial':''}</p><dl className="reserva-importes"><div><dt>Tarifa</dt><dd>{compra.moneda} {Number(d.precio_base).toFixed(2)}</dd></div><div><dt>Descuento</dt><dd>− {Number(d.descuento).toFixed(2)}</dd></div><div><dt>Total pasajero</dt><dd>{compra.moneda} {Number(d.importe).toFixed(2)}</dd></div></dl></article>)}</div>
      {pagada&&<section className="panel"><h2>Documentos de la venta</h2><div className="acciones"><a className="btn btn-claro" href={`/api/boletos/recibos/${id}`} download>Descargar comprobante no fiscal</a><a className="btn btn-claro" href={`/api/boletos/recibos/${id}?imprimir=1`} target="_blank" rel="noreferrer">Abrir comprobante para imprimir</a></div>{compra.boletos.filter(b=>b.estado==='EMITIDO').map((b,i)=><article className="documento-venta" key={b.id}><strong>Boleto {i+1} · {b.codigo.slice(0,8).toUpperCase()}</strong><div className="acciones"><Link className="btn btn-claro" to={`/boleto/${b.id}`}>Ver QR y detalle</Link><a className="btn btn-oscuro" href={`/api/boletos/${b.id}/pdf`} download>Descargar boleto PDF</a><a className="btn btn-claro" href={`/api/boletos/${b.id}/pdf?imprimir=1`} target="_blank" rel="noreferrer">Abrir boleto para imprimir</a></div></article>)}</section>}
      <section className="panel"><h2>Pagos</h2>{!compra.pagos.length&&<p>Sin pagos registrados.</p>}{compra.pagos.map(p=><article className="documento-venta" key={p.id}><strong>{p.metodo} · {p.estado.replaceAll('_',' ')}</strong>{p.motivo&&<p>{p.motivo}</p>}{p.estado==='CORRECCION'&&<Link className="btn btn-claro" to={`/pagar/${id}`}>Corregir comprobante</Link>}</article>)}{compra.motivo&&<p>{compra.motivo}</p>}</section>
      {plazos.filter(p=>!['APROBADA','RECHAZADA'].includes(p.estado)).map(p=><p key={p.id}>Revisión hasta {new Date(p.revisionVenceEn).toLocaleString('es-EC')}{p.correccionVenceEn&&' · Corrección hasta '+new Date(p.correccionVenceEn).toLocaleString('es-EC')}</p>)}
      <div className="acciones"><Link className="btn btn-claro" to={`/incidencias?compraId=${id}`}>Incidencias y devoluciones</Link></div>
      {['RESERVADA','VENCIDA'].includes(compra.estado)&&!compra.pagos.length&&<form className="panel" onSubmit={cancelar}><label>Motivo de cancelación<input required maxLength={500} value={motivo} onChange={e=>setMotivo(e.target.value)}/></label><button className="btn btn-claro" disabled={ocupado}>Cancelar reserva sin pago</button></form>}
    </>}
  </div>
}
