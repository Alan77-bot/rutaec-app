import { useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import VistaDocumentoRevision from './VistaDocumentoRevision'
import './Revisiones.css'

const ESTADOS={PENDIENTE:'Pendiente',EN_REVISION:'En revisión',CORRECCION:'Corrección solicitada',APROBADA:'Aprobada',RECHAZADA:'Rechazada'}
const fecha=valor=>valor?new Date(valor).toLocaleString('es-EC',{timeZone:'America/Guayaquil',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—'
const persona=r=>{const p=r.solicitante||r.validaciones_descuento?.pasajeros||r.pagos?.compras?.usuarios_compras_comprador_idTousuarios;return p?`${p.nombres} ${p.apellidos}`:'Solicitante sin datos'}
const prioridad={PENDIENTE:0,EN_REVISION:1,CORRECCION:2,APROBADA:3,RECHAZADA:4}
const ordenar=lista=>[...lista].sort((a,b)=>(prioridad[a.estado]??5)-(prioridad[b.estado]??5)||new Date(b.creado_en)-new Date(a.creado_en))

export default function Revisiones() {
  const {sesion}=useApp()
  const [lista,setLista]=useState(null),[seleccion,setSeleccion]=useState(null),[version,setVersion]=useState(0)
  const [estado,setEstado]=useState(''),[tipo,setTipo]=useState(''),[buscar,setBuscar]=useState('')
  const [motivo,setMotivo]=useState(''),[importe,setImporte]=useState(''),[referencia,setReferencia]=useState(''),[usuarioId,setUsuarioId]=useState('')
  const [documentoId,setDocumentoId]=useState(''),[confirmado,setConfirmado]=useState(false)
  const [error,setError]=useState(''),[mensaje,setMensaje]=useState(''),[ocupado,setOcupado]=useState(false),[cargando,setCargando]=useState(true)
  useEffect(()=>{
    const control=new AbortController();setCargando(true)
    fetch('/api/pagos/revisiones',{credentials:'include',signal:control.signal}).then(async r=>{const b=await r.json();if(!r.ok)throw new Error(b.error||'No se pudo cargar la bandeja.');return ordenar(b.datos)})
      .then(datos=>{if(control.signal.aborted)return;setLista(datos);setSeleccion(actual=>datos.find(r=>r.id===actual?.id)||datos.find(r=>r.estado==='PENDIENTE')||datos[0]||null)})
      .catch(e=>{if(!control.signal.aborted)setError(e.message)})
      .finally(()=>{if(!control.signal.aborted)setCargando(false)})
    const timer=setInterval(()=>setVersion(v=>v+1),15000)
    return()=>{control.abort();clearInterval(timer)}
  },[version])
  useEffect(()=>{setMotivo('');setReferencia('');setImporte(seleccion?.pagos?.importe??'');setUsuarioId('');setDocumentoId('');setConfirmado(false)},[seleccion?.id])
  async function ejecutar(accion,extra={}){
    if(ocupado||!seleccion)return;setOcupado(true);setError('');setMensaje('')
    try{const r=await fetch(`/api/pagos/revisiones/${seleccion.id}/${accion}`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({motivo,importeVerificado:importe,referencia,usuarioId:usuarioId||null,...extra})});const b=await r.json();if(!r.ok)throw new Error(b.error||'No se pudo completar la operación.');setMensaje(b.mensaje);setVersion(v=>v+1)}catch(e){setError(e.message)}finally{setOcupado(false)}
  }
  const visibles=(lista||[]).filter(r=>(!estado||r.estado===estado)&&(!tipo||r.tipo===tipo)&&`${persona(r)} ${r.id} ${r.validaciones_descuento?.pasajeros?.numero_documento||''} ${r.pagos?.comprobantes_pago?.map(c=>c.numero_referencia).join(' ')||''}`.toLowerCase().includes(buscar.toLowerCase()))
  const propia=seleccion?.asignado_a===sesion.id
  const abierta=seleccion&&['PENDIENTE','EN_REVISION','CORRECCION'].includes(seleccion.estado)
  const resolver=propia&&seleccion?.estado==='EN_REVISION'
  const gestion=['admin','cooperativa'].includes(sesion.rol)
  const validacion=seleccion?.validaciones_descuento
  const documentos=seleccion?.documentos||[]
  const documento=documentos.find(d=>d.id===documentoId)||documentos[0]
  const puedeAprobar=!!motivo.trim()&&(!seleccion?.pagos||(confirmado&&Number(importe)>0&&referencia.trim().length>=3))
  return <div className="contenedor revisiones-espacio">
    <header className="revisiones-cabecera"><div><span className="ui-eyebrow">PAGOS Y DOCUMENTOS</span><h1>Centro de revisiones</h1></div><button type="button" className="btn btn-claro" disabled={cargando||ocupado} onClick={()=>{setError('');setVersion(v=>v+1)}}>{cargando?'Actualizando…':'↻ Actualizar'}</button></header>
    <div className="revisiones-resumen" aria-label="Resumen de solicitudes">{[['','Todas'],['PENDIENTE','Pendientes'],['EN_REVISION','En revisión'],['APROBADA','Aprobadas']].map(([valor,titulo])=><button type="button" key={titulo} className={estado===valor?'activa':''} aria-pressed={estado===valor} onClick={()=>setEstado(valor)}><span>{titulo}</span><strong>{lista?lista.filter(r=>!valor||r.estado===valor).length:'—'}</strong></button>)}</div>
    <div className="revisiones-filtros"><label>Buscar solicitud<input type="search" placeholder="Nombre, documento o referencia…" value={buscar} onChange={e=>setBuscar(e.target.value)}/></label><label>Tipo<select value={tipo} onChange={e=>setTipo(e.target.value)}><option value="">Todos</option><option value="PAGO">Pagos</option><option value="DESCUENTO">Descuentos</option></select></label><label>Estado<select value={estado} onChange={e=>setEstado(e.target.value)}><option value="">Todos</option>{Object.entries(ESTADOS).map(([valor,nombre])=><option key={valor} value={valor}>{nombre}</option>)}</select></label></div>
    {error&&<p role="alert" className="auth-aviso">{error}</p>}{mensaje&&<p role="status" className="revision-exito">{mensaje}</p>}
    <div className="revisiones-distribucion">
      <aside className="revisiones-listado" aria-label="Solicitudes"><div className="revision-listado-titulo"><h2>Solicitudes</h2><span>{visibles.length}</span></div>
        {!lista&&cargando&&<p role="status">Cargando solicitudes…</p>}
        {lista&&visibles.length===0&&<div className="revision-documento-vacio"><strong>Sin solicitudes</strong>{lista.length>0&&<button type="button" className="btn-link" onClick={()=>{setBuscar('');setEstado('');setTipo('')}}>Limpiar filtros</button>}</div>}
        {visibles.map(r=><button type="button" key={r.id} className={`revision-fila ${seleccion?.id===r.id?'seleccionada':''}`} aria-pressed={seleccion?.id===r.id} onClick={()=>{setSeleccion(r);setMensaje('');setError('')}}><div className="revision-fila-superior"><span className="revision-avatar" aria-hidden="true">{persona(r).charAt(0).toUpperCase()}</span><div><strong>{persona(r)}</strong><small>{r.tipo==='PAGO'?'Comprobante de pago':'Solicitud de descuento'}</small></div></div><div className="revision-fila-pie"><span className={`revision-estado estado-${r.estado.toLowerCase()}`}>{ESTADOS[r.estado]||r.estado}</span><time>{fecha(r.creado_en)}</time></div><small className="revision-asignacion">{r.asignado_a===sesion.id?'Asignada a ti':r.responsable||'Sin asignar'}</small></button>)}
      </aside>
      <section className="revision-detalle" aria-label="Detalle de la solicitud">
        {!seleccion?<div className="revision-documento-vacio"><span aria-hidden="true">▤</span><strong>No hay una solicitud seleccionada</strong></div>:<>
          <header className="revision-detalle-cab"><div><span className="ui-eyebrow">{seleccion.tipo==='PAGO'?'REVISIÓN DE PAGO':'VALIDACIÓN DE DESCUENTO'} · #{seleccion.id.slice(0,8).toUpperCase()}</span><h2>{persona(seleccion)}</h2>{seleccion.solicitante?.correo&&<p>{seleccion.solicitante.correo}</p>}</div><span className={`revision-estado estado-${seleccion.estado.toLowerCase()}`}>{ESTADOS[seleccion.estado]||seleccion.estado}</span></header>
          <dl className="revision-datos"><div><dt>Recibida</dt><dd>{fecha(seleccion.creado_en)}</dd></div><div><dt>Responsable</dt><dd>{seleccion.asignado_a===sesion.id?'Tú':seleccion.responsable||'Sin asignar'}</dd></div>{seleccion.pagos?<div><dt>Importe de la compra</dt><dd>{seleccion.pagos.moneda} {Number(seleccion.pagos.importe).toFixed(2)}</dd></div>:<div><dt>Tipo de descuento</dt><dd>{validacion?.politicas_descuento.descripcion} · {validacion?.politicas_descuento.porcentaje}%</dd></div>}</dl>
          {validacion&&<div className="revision-beneficiario"><strong>{validacion.pasajeros.nombres} {validacion.pasajeros.apellidos}</strong><span>{validacion.pasajeros.tipo_documento} · {validacion.pasajeros.numero_documento}</span><span>Nacimiento: {validacion.pasajeros.fecha_nacimiento.slice(0,10)} · Vigencia solicitada: {validacion.valido_hasta.slice(0,10)}</span></div>}
          {seleccion.pagos&&<div className="revision-beneficiario">{seleccion.pagos.compras?.detalle_compra_detalle_compra_compra_id_comprador_idTocompras?.map((d,i)=><div key={i}><strong>{d.pasajero_snapshot.nombres} {d.pasajero_snapshot.apellidos}</strong><span>{d.pasajero_snapshot.numero_documento} · Asiento {d.asiento_snapshot.numero} · {d.asiento_snapshot.categoria}</span></div>)}</div>}
          <div className="revision-evidencia-cab"><h3>{seleccion.tipo==='PAGO'?'Comprobante adjunto':'Documento adjunto'}</h3>{documentos.length>1&&<label>Versión<select value={documento?.id||''} onChange={e=>setDocumentoId(e.target.value)}>{documentos.map((d,i)=><option key={d.id} value={d.id}>{i===0?'Más reciente':'Anterior'} · {fecha(d.fecha)} · {d.nombre}</option>)}</select></label>}</div>
          {documento?.referencia&&<div className="revision-referencia"><span>Referencia: <strong>{documento.referencia}</strong></span><span>Declarado: <strong>USD {Number(documento.importe).toFixed(2)}</strong></span></div>}
          <VistaDocumentoRevision key={`${seleccion.id}:${documento?.id||'sin-documento'}`} documento={documento}/>
          {seleccion.alertado_en&&<p className="auth-aviso">Plazo excedido. Revisa la incidencia antes de resolver el pago.</p>}
          {abierta&&<div className="revision-plazo"><span>Revisión hasta {fecha(seleccion.plazos?.revisionVenceEn)}</span>{seleccion.plazos?.correccionVenceEn&&<span>Corrección hasta {fecha(seleccion.plazos.correccionVenceEn)}</span>}</div>}
          {abierta&&<section className="revision-decision"><div className="cabecera-acciones"><h3>Resolver solicitud</h3>{!seleccion.asignado_a&&sesion.rol!=='cooperativa'&&<button type="button" className="btn btn-oscuro" disabled={ocupado} onClick={()=>ejecutar('tomar')}>{ocupado?'Procesando…':'Tomar revisión'}</button>}</div>
            {!resolver?<p className="muted">{seleccion.asignado_a&&!propia?`En atención por ${seleccion.responsable||'otro revisor'}.`:seleccion.estado==='CORRECCION'?'Esperando la corrección solicitada.':'Toma la revisión para registrar una decisión.'}</p>:<>
              {seleccion.pagos&&<div className="revision-formulario"><label>Importe verificado en el banco<input type="number" step="0.01" min="0.01" value={importe} onChange={e=>setImporte(e.target.value)}/></label><label>Referencia bancaria verificada<input maxLength={40} value={referencia} onChange={e=>setReferencia(e.target.value)}/></label><label className="revision-checkbox"><input type="checkbox" checked={confirmado} onChange={e=>setConfirmado(e.target.checked)}/>He comprobado el ingreso en la cuenta bancaria.</label></div>}
              <label className="revision-motivo">Motivo de la decisión<textarea rows={3} maxLength={500} placeholder="Resultado de la comprobación…" value={motivo} onChange={e=>setMotivo(e.target.value)}/></label><div className="acciones"><button type="button" className="btn btn-oscuro" disabled={ocupado||!puedeAprobar} onClick={()=>ejecutar('resolver',{decision:'APROBAR'})}>Aprobar</button><button type="button" className="btn btn-claro" disabled={ocupado||!motivo.trim()} onClick={()=>ejecutar('resolver',{decision:'CORREGIR'})}>Solicitar corrección</button><button type="button" className="btn btn-danger" disabled={ocupado||!motivo.trim()} onClick={()=>ejecutar('resolver',{decision:'RECHAZAR'})}>Rechazar</button></div>
            </>}
            {(propia||gestion)&&<details className="revision-avanzado"><summary>Asignación y seguimiento</summary>{!resolver&&<label>Motivo<textarea maxLength={500} value={motivo} onChange={e=>setMotivo(e.target.value)}/></label>}{propia&&<button type="button" className="btn btn-claro" disabled={ocupado||!motivo.trim()} onClick={()=>ejecutar('liberar')}>Liberar revisión</button>}{gestion&&<><label>Identificador del revisor (vacío para liberar)<input value={usuarioId} onChange={e=>setUsuarioId(e.target.value)}/></label><button type="button" className="btn btn-claro" disabled={ocupado||!motivo.trim()} onClick={()=>ejecutar('reasignar')}>Reasignar</button></>}</details>}
          </section>}
          {!abierta&&seleccion.motivo&&<div className="revision-resultado"><strong>Decisión registrada</strong><p>{seleccion.motivo}</p></div>}
          <details className="revision-historial"><summary>Historial de la solicitud <span>{seleccion.historial_revisiones.length}</span></summary>{seleccion.historial_revisiones.length===0&&<p>Sin movimientos registrados.</p>}<ol>{seleccion.historial_revisiones.map((h,i)=><li key={i}><strong>{h.accion.replaceAll('_',' ')}</strong><small>{h.actor_nombre||'Usuario registrado'} · {fecha(h.fecha)}</small>{h.motivo&&<p>{h.motivo}</p>}</li>)}{seleccion.historial_sistema?.map((h,i)=><li key={`s-${i}`}><strong>Sistema</strong><small>{fecha(h.creado_en)}</small><p>{h.datos.motivo}</p></li>)}</ol></details>
        </>}
      </section>
    </div>
  </div>
}
