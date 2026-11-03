import { useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { useSearchParams } from 'react-router-dom'

export default function Incidencias() {
  const {sesion}=useApp()
  const [parametros] = useSearchParams()
  const [lista,setLista]=useState(null)
  const [form,setForm]=useState({compraId:parametros.get('compraId') ?? '',tipo:'CANCELACION',motivo:''})
  const [elegida,setElegida]=useState(null)
  const [decision,setDecision]=useState({decision:'CERRAR',motivo:'',importe:'',referencia:'',cuentaId:'',metodo:'TRANSFERENCIA',cancelarCompra:false})
  const [error,setError]=useState(''),[mensaje,setMensaje]=useState(''),[version,setVersion]=useState(0),[ocupado,setOcupado]=useState(false)
  const personal=['admin','oficinista'].includes(sesion.rol)
  useEffect(()=>{const c=new AbortController();fetch('/api/incidencias',{credentials:'include',signal:c.signal}).then(async r=>{const b=await r.json();if(!r.ok)throw new Error(b.error??'No se pudo consultar.');return b.datos}).then(setLista).catch(e=>{if(e.name!=='AbortError')setError(e.message)});return()=>c.abort()},[version])
  async function enviar(ruta,datos){if(ocupado)return;setOcupado(true);setError('');setMensaje('');try{const r=await fetch('/api/incidencias'+ruta,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(datos)});const b=await r.json();if(!r.ok)throw new Error(b.error??'No se pudo procesar.');setMensaje(b.mensaje);setVersion(v=>v+1);setElegida(null)}catch(e){setError(e.message)}finally{setOcupado(false)}}
  const campo=(k,v)=>setDecision(d=>({...d,[k]:v}))
  return <div className="contenedor"><h1>Cancelaciones e incidencias</h1><p>Las solicitudes pagadas y las devoluciones se revisan manualmente. No se calcula un porcentaje automático ni se mueve dinero desde esta pantalla.</p>
    {error&&<p role="alert" className="auth-aviso">{error}</p>}{mensaje&&<p role="status">{mensaje}</p>}
    <form className="panel auth-campos" onSubmit={e=>{e.preventDefault();enviar('',form)}}><h2>Nueva solicitud</h2><label>Código completo de compra<input required value={form.compraId} onChange={e=>setForm({...form,compraId:e.target.value})}/></label><label>Tipo<select value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value})}><option value="CANCELACION">Solicitar cancelación</option><option value="PAGO_TARDIO">Informar pago después del vencimiento</option><option value="DEVOLUCION">Solicitar devolución</option></select></label><label>Motivo y datos para revisión<textarea required maxLength={1000} value={form.motivo} onChange={e=>setForm({...form,motivo:e.target.value})}/></label><button className="btn btn-oscuro" disabled={ocupado}>Registrar solicitud</button></form>
    <button className="btn btn-claro" onClick={()=>setVersion(v=>v+1)}>Actualizar</button>
    {!lista&&<p>Cargando…</p>}{lista?.length===0&&<p>No hay solicitudes.</p>}
    {lista?.map(i=><article className="panel" key={i.id}><h2>{i.tipo} · {i.estado}</h2><p>Compra: {i.compra_id}</p><p>{i.descripcion}</p>{i.resolucion&&<p>Respuesta: {i.resolucion}</p>}
      {i.reembolsos.map(r=><div key={r.id}><p>Reembolso: {r.importe} · {r.estado}{r.referencia&&` · referencia ${r.referencia}`}</p>{personal&&r.estado==='APROBADO'&&<form onSubmit={e=>{e.preventDefault();enviar(`/reembolsos/${r.id}/realizado`,{referencia:decision.referencia})}}><label>Referencia de la devolución efectivamente realizada<input required value={decision.referencia} onChange={e=>campo('referencia',e.target.value)}/></label><button className="btn btn-claro" disabled={ocupado}>Confirmar devolución realizada</button></form>}</div>)}
      {personal&&i.estado!=='RESUELTA'&&<button className="btn btn-claro" onClick={()=>setElegida(i)}>Atender</button>}
    </article>)}
    {elegida&&<form className="panel auth-campos" onSubmit={e=>{e.preventDefault();enviar(`/${elegida.id}/resolver`,decision)}}><h2>Atender {elegida.tipo}</h2><label>Decisión<select value={decision.decision} onChange={e=>campo('decision',e.target.value)}><option value="CERRAR">Cerrar con respuesta</option><option value="REEMBOLSO">Aprobar devolución manual</option>{!elegida.pago_id&&<option value="REGISTRAR_PAGO_TARDIO">Registrar dinero tardío comprobado en el banco</option>}</select></label><label>Motivo de la decisión<textarea required maxLength={1000} value={decision.motivo} onChange={e=>campo('motivo',e.target.value)}/></label>
      {decision.decision!=='CERRAR'&&<label>Importe comprobado o devolución aprobada<input type="number" min="0.01" step="0.01" required value={decision.importe} onChange={e=>campo('importe',e.target.value)}/></label>}
      {decision.decision==='REEMBOLSO'&&<label><input type="checkbox" checked={decision.cancelarCompra} onChange={e=>campo('cancelarCompra',e.target.checked)}/>Cancelar la compra completa y anular todos sus boletos (decisión explícita)</label>}
      {decision.decision==='REGISTRAR_PAGO_TARDIO'&&<><label>Cuenta bancaria receptora (identificador)<input required value={decision.cuentaId} onChange={e=>campo('cuentaId',e.target.value)}/></label><label>Referencia comprobada<input required value={decision.referencia} onChange={e=>campo('referencia',e.target.value)}/></label><label>Método<select value={decision.metodo} onChange={e=>campo('metodo',e.target.value)}><option value="TRANSFERENCIA">Transferencia</option><option value="DEPOSITO">Depósito</option></select></label><p>Registrar dinero no recupera ni reasigna un asiento. Acuerda una nueva reserva o devolución con el cliente.</p></>}
      <button className="btn btn-acento" disabled={ocupado}>Guardar decisión</button>
    </form>}
  </div>
}
