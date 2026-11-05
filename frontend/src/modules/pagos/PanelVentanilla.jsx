import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { urlCompra } from '../reservas/reservas.enlaces'

export default function PanelVentanilla() {
  const nav=useNavigate()
  const [form,setForm]=useState({documento:'',nombres:'',apellidos:'',correo:''})
  const [comprador,setComprador]=useState(null),[salidas,setSalidas]=useState(null),[resumen,setResumen]=useState(null)
  const [fecha,setFecha]=useState(''),[origen,setOrigen]=useState(''),[destino,setDestino]=useState(''),[n,setN]=useState(1)
  const [error,setError]=useState(''),[ocupado,setOcupado]=useState(false)
  useEffect(()=>{const c=new AbortController();fetch('/api/ventas/resumen',{credentials:'include',signal:c.signal}).then(r=>r.ok?r.json():null).then(b=>setResumen(b?.datos)).catch(()=>{});return()=>c.abort()},[])
  useEffect(()=>{
    if(!comprador)return
    const c=new AbortController();setSalidas(null);setError('')
    fetch('/api/ventas/salidas?'+new URLSearchParams(fecha?{fecha}:{}),{credentials:'include',signal:c.signal}).then(async r=>{const b=await r.json();if(!r.ok)throw new Error(b.error||'No se pudieron cargar las salidas.');return b.datos}).then(setSalidas).catch(e=>{if(!c.signal.aborted)setError(e.message)})
    return()=>c.abort()
  },[comprador,fecha])
  async function continuar(e){
    e.preventDefault();if(ocupado)return;setOcupado(true);setError('')
    try{const r=await fetch('/api/ventas/comprador',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});const b=await r.json();if(!r.ok)throw new Error(b.error);setComprador(b.datos);sessionStorage.removeItem('rutaec:comprador-ventanilla');sessionStorage.setItem('rutaec:comprador-presencial',JSON.stringify(b.datos))}catch(e){setError(e.message)}finally{setOcupado(false)}
  }
  const visibles=salidas?.filter(v=>(!origen||v.origen_ciudad===origen)&&(!destino||v.destino_ciudad===destino))
  return <div className="contenedor ventanilla-mejorada"><div className="cabecera-acciones"><h1>Ventanilla</h1><div className="acciones"><Link className="btn btn-claro" to="/mis-reservas">Ventas</Link><Link className="btn btn-claro" to="/revisiones">Revisiones</Link></div></div>
    {resumen&&<div className="metricas-operacion"><article><span>Cobros confirmados</span><strong>USD {resumen.cobrados}</strong></article><article><span>Devoluciones</span><strong>USD {resumen.devueltos}</strong></article><article><span>Revisiones pendientes</span><strong>{resumen.pendientes}</strong></article></div>}
    {error&&<p className="auth-aviso" role="alert">{error}</p>}
    <section className="panel"><h2>Comprador presencial</h2>{comprador?<div className="cabecera-acciones"><div><strong>{comprador.nombres} {comprador.apellidos}</strong><p>Cédula {comprador.documento}{comprador.correo&&' · '+comprador.correo}</p></div><button className="btn btn-claro" onClick={()=>{setComprador(null);setSalidas(null);sessionStorage.removeItem('rutaec:comprador-presencial')}}>Cambiar comprador</button></div>:<form onSubmit={continuar}><label>Cédula<input required inputMode="numeric" pattern="[0-9]{10}" maxLength={10} value={form.documento} onChange={e=>setForm({...form,documento:e.target.value})}/></label><label>Nombres<input required value={form.nombres} onChange={e=>setForm({...form,nombres:e.target.value})}/></label><label>Apellidos<input required value={form.apellidos} onChange={e=>setForm({...form,apellidos:e.target.value})}/></label><label>Correo (opcional)<input type="email" value={form.correo} onChange={e=>setForm({...form,correo:e.target.value})}/></label><button className="btn btn-oscuro" disabled={ocupado}>{ocupado?'Validando…':'Ver salidas'}</button></form>}</section>
    {comprador&&<section><div className="barra-filtros"><label>Fecha<input type="date" value={fecha} onChange={e=>setFecha(e.target.value)}/></label><label>Origen<select value={origen} onChange={e=>setOrigen(e.target.value)}><option value="">Todos</option>{[...new Set(salidas?.map(v=>v.origen_ciudad)||[])].map(c=><option key={c}>{c}</option>)}</select></label><label>Destino<select value={destino} onChange={e=>setDestino(e.target.value)}><option value="">Todos</option>{[...new Set(salidas?.map(v=>v.destino_ciudad)||[])].map(c=><option key={c}>{c}</option>)}</select></label><label>Pasajeros<input type="number" min={1} max={10} value={n} onChange={e=>setN(Number(e.target.value))}/></label></div>
      {salidas===null&&<p role="status">Consultando salidas…</p>}{visibles?.length===0&&<div className="estado-vacio">No hay salidas disponibles con estos filtros.</div>}
      <div className="reservas-grid">{visibles?.map(v=><article className="panel reserva-tarjeta" key={v.viaje_id}><h3>{v.origen_ciudad} → {v.destino_ciudad}</h3><strong>{new Date(v.salida).toLocaleString('es-EC',{timeZone:'America/Guayaquil'})}</strong><p>{v.cupos_disponibles} asientos disponibles</p><button className="btn btn-oscuro" disabled={v.cupos_disponibles<n||n<1||n>10} onClick={()=>nav(urlCompra(v.viaje_id,{origen:v.origen_ciudad,destino:v.destino_ciudad,fecha:new Date(v.salida).toLocaleDateString('en-CA',{timeZone:'America/Guayaquil'}),pasajeros:n}))}>Elegir asientos</button></article>)}</div>
    </section>}
  </div>
}
