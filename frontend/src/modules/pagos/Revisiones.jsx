import { useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'

export default function Revisiones() {
  const { sesion } = useApp()
  const [lista, setLista] = useState(null)
  const [estado, setEstado] = useState('')
  const [seleccion, setSeleccion] = useState(null)
  const [motivo, setMotivo] = useState('')
  const [importe, setImporte] = useState('')
  const [referencia, setReferencia] = useState('')
  const [usuarioId, setUsuarioId] = useState('')
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [version, setVersion] = useState(0)
  useEffect(() => {
    const c = new AbortController()
    fetch(`/api/pagos/revisiones?estado=${estado}`, { credentials: 'include', signal: c.signal }).then(async r => {
      const b = await r.json(); if (!r.ok) throw new Error(b.error ?? 'No se pudo cargar la bandeja.'); return b.datos
    }).then(datos => { setLista(datos); setSeleccion(actual => datos.find(r => r.id === actual?.id) ?? null) }).catch(e => { if (e.name !== 'AbortError') setError(e.message) })
    const intervalo=setInterval(()=>setVersion(v=>v+1),15000)
    return () => { c.abort(); clearInterval(intervalo) }
  }, [estado, version])
  async function ejecutar(accion, extra = {}) {
    if (ocupado || !seleccion) return; setOcupado(true); setError(''); setMensaje('')
    try {
      const r = await fetch(`/api/pagos/revisiones/${seleccion.id}/${accion}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ motivo, importeVerificado: importe, referencia, usuarioId: usuarioId || null, ...extra }) }); const b = await r.json()
      if (!r.ok) throw new Error(b.error ?? 'No se pudo completar la operación.')
      setMensaje(b.mensaje); setVersion(v => v + 1)
    } catch (e) { setError(e.message) } finally { setOcupado(false) }
  }
  const propia = seleccion?.asignado_a === sesion.id
  const gestion = ['admin','cooperativa'].includes(sesion.rol)
  return <div className="contenedor"><h1>Bandeja de revisiones</h1><p>Pagos y descuentos de tu cooperativa. Tomar una revisión la asigna exclusivamente a una persona.</p>
    {error && <p role="alert" className="auth-aviso">{error}</p>}{mensaje && <p role="status">{mensaje}</p>}
    <label>Estado<select value={estado} onChange={e => setEstado(e.target.value)}><option value="">Todos</option>{['PENDIENTE','EN_REVISION','CORRECCION','APROBADA','RECHAZADA'].map(e => <option key={e}>{e}</option>)}</select></label>
    <button className="btn btn-claro" onClick={() => setVersion(v => v + 1)}>Actualizar</button>
    <div className="dos-col"><section className="panel">
      {!lista && <p>Cargando…</p>}{lista?.length === 0 && <p>No hay trámites.</p>}
      {lista?.map(r => <article key={r.id}><button className="btn btn-claro" onClick={() => { setSeleccion(r); setMotivo(''); setReferencia(''); setImporte(r.pagos?.importe ?? '') }}>{r.tipo} · {r.estado} · {r.id.slice(0,8)}</button><p>Responsable: {r.asignado_a ?? 'Sin asignar'} · {new Date(r.creado_en).toLocaleString('es-EC')}</p></article>)}
    </section><section className="panel">
      {!seleccion ? <p>Selecciona un trámite.</p> : <><h2>{seleccion.tipo}</h2><p>Estado: {seleccion.estado}</p>
        <p>Revisión hasta: {new Date(seleccion.plazos.revisionVenceEn).toLocaleString('es-EC',{timeZone:'America/Guayaquil'})}</p>
        {seleccion.plazos.correccionVenceEn&&<p>Corrección hasta: {new Date(seleccion.plazos.correccionVenceEn).toLocaleString('es-EC',{timeZone:'America/Guayaquil'})}</p>}
        {seleccion.plazos.asignacionVenceEn&&<p>Asignación vigente hasta: {new Date(seleccion.plazos.asignacionVenceEn).toLocaleString('es-EC',{timeZone:'America/Guayaquil'})}. Después se libera para otro oficinista.</p>}
        {seleccion.alertado_en&&<p role="status">Plazo excedido. Revisa la incidencia antes de confirmar el pago; no se recupera un asiento automáticamente.</p>}
        {seleccion.pagos && <><p>Compra {seleccion.pagos.compra_id} · {seleccion.pagos.moneda} {seleccion.pagos.importe}</p>
          {seleccion.pagos.comprobantes_pago.map(c => <p key={c.id}>Referencia {c.numero_referencia} · importe declarado {c.importe_declarado} · {c.fecha_operacion.slice(0,10)} <a href={`/api/pagos/revisiones/${seleccion.id}/archivos/${c.archivo_id}`} target="_blank" rel="noreferrer">Ver evidencia</a></p>)}
          <label>Importe contrastado con el banco<input type="number" step="0.01" min="0.01" value={importe} onChange={e => setImporte(e.target.value)} /></label>
          <label>Referencia bancaria verificada<input maxLength={100} value={referencia} onChange={e => setReferencia(e.target.value)} /></label>
          <p>Una fotografía no demuestra que el dinero ingresó. Comprueba referencia, fecha, cuenta e importe antes de aprobar.</p></>}
        {seleccion.validaciones_descuento && <><p>{seleccion.validaciones_descuento.pasajeros.nombres} {seleccion.validaciones_descuento.pasajeros.apellidos} · nacimiento {seleccion.validaciones_descuento.pasajeros.fecha_nacimiento.slice(0,10)}</p><p>Política: {seleccion.validaciones_descuento.politicas_descuento.descripcion}</p><a href={`/api/reservas/descuentos/documentos/${seleccion.validaciones_descuento.documento_id}`} target="_blank" rel="noreferrer">Documento del pasajero</a></>}
        <label>Motivo de la decisión o reasignación<textarea maxLength={500} value={motivo} onChange={e => setMotivo(e.target.value)} /></label>
        <div className="acciones">
          {!seleccion.asignado_a && sesion.rol !== 'cooperativa' && <button className="btn btn-oscuro" disabled={ocupado} onClick={() => ejecutar('tomar')}>Tomar revisión</button>}
          {propia && <><button className="btn btn-acento" disabled={ocupado || !motivo.trim()} onClick={() => ejecutar('resolver', { decision: 'APROBAR' })}>Aprobar</button><button className="btn btn-claro" disabled={ocupado || !motivo.trim()} onClick={() => ejecutar('resolver', { decision: 'CORREGIR' })}>Solicitar corrección</button><button className="btn btn-claro" disabled={ocupado || !motivo.trim()} onClick={() => ejecutar('resolver', { decision: 'RECHAZAR' })}>Rechazar</button><button className="btn btn-claro" disabled={ocupado || !motivo.trim()} onClick={() => ejecutar('liberar')}>Liberar revisión</button></>}
        </div>
        {gestion && <div><label>Identificador del nuevo revisor (vacío para liberar)<input value={usuarioId} onChange={e => setUsuarioId(e.target.value)} /></label><button className="btn btn-claro" disabled={ocupado || !motivo.trim()} onClick={() => ejecutar('reasignar')}>Reasignar con motivo</button></div>}
        <h3>Historial</h3>{seleccion.historial_revisiones.map((h,i) => <p key={i}>{new Date(h.fecha).toLocaleString('es-EC')} · {h.accion} · {h.motivo}</p>)}
        {seleccion.historial_sistema?.map((h,i)=><p key={`sistema-${i}`}>{new Date(h.creado_en).toLocaleString('es-EC')} · SISTEMA · {h.datos.motivo}</p>)}
      </>}
    </section></div>
  </div>
}
