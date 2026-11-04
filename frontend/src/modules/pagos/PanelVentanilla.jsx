import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { urlCompra } from '../reservas/reservas.enlaces'

export default function PanelVentanilla() {
  const { sesion } = useApp()
  const nav = useNavigate()
  const [resumen, setResumen] = useState(null)
  const [correo, setCorreo] = useState('')
  const [comprador, setComprador] = useState(null)
  const [origen, setOrigen] = useState('')
  const [destino, setDestino] = useState('')
  const [fecha, setFecha] = useState('')
  const [n, setN] = useState(1)
  const [viajes, setViajes] = useState(null)
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  useEffect(() => { sessionStorage.removeItem('rutaec:comprador-ventanilla'); const c=new AbortController(); fetch('/api/ventas/resumen',{credentials:'include',signal:c.signal}).then(r=>r.ok?r.json():null).then(b=>setResumen(b?.datos??null)).catch(()=>{}); return()=>c.abort() }, [])
  async function buscarComprador(e) {
    e.preventDefault(); if (ocupado) return; setOcupado(true); setError(''); setComprador(null); sessionStorage.removeItem('rutaec:comprador-ventanilla')
    try {
      const r = await fetch(`/api/ventas/comprador?correo=${encodeURIComponent(correo)}`, { credentials:'include' }); const b = await r.json()
      if (!r.ok) throw new Error(b.error ?? 'No se pudo consultar.')
      setComprador(b.datos); sessionStorage.setItem('rutaec:comprador-ventanilla',b.datos.id)
    } catch (e) { setError(e.message) } finally { setOcupado(false) }
  }
  async function buscarViajes(e) {
    e.preventDefault(); if (ocupado) return; setOcupado(true); setError('')
    try {
      const q = new URLSearchParams({ origen,destino,fecha })
      const r = await fetch(`/api/reservas/viajes?${q}`, { credentials:'include' }); const b = await r.json()
      if (!r.ok) throw new Error(b.error ?? 'No se pudo buscar.')
      setViajes(b.data.filter(v => v.cooperativa.id === sesion.coopId))
    } catch (e) { setError(e.message) } finally { setOcupado(false) }
  }
  return <div className="contenedor ventanilla-mejorada"><div className="seccion-cab izq"><span className="ui-eyebrow">NUEVA VENTA</span><h1>Venta en ventanilla</h1></div>
    <div className="acciones"><Link className="btn btn-claro" to="/revisiones">Revisar pagos y descuentos</Link><Link className="btn btn-claro" to="/mis-reservas">Reservas y ventas</Link><Link className="btn btn-claro" to="/incidencias">Incidencias y reembolsos</Link></div>
    {error && <p className="auth-aviso" role="alert">{error}</p>}
    {resumen && <section aria-label="Resumen de la cooperativa"><div className="metricas-operacion"><article><span>Cobros confirmados</span><strong>USD {resumen.cobrados}</strong><small>Pagos aprobados de la cooperativa</small></article><article><span>Devoluciones realizadas</span><strong>USD {resumen.devueltos}</strong><small>Importes devueltos al comprador</small></article><article><span>Revisiones pendientes</span><strong>{resumen.pendientes}</strong><Link to="/revisiones">Ir a revisiones →</Link></article></div><p className="nota-contexto">Demostraciones sin cobro: USD {resumen.demostracion}. Las reservas pendientes no cuentan como ingresos.</p></section>}
    <section className="panel"><h2>Comprador</h2>
      <form onSubmit={buscarComprador}><label>Correo del comprador<input type="email" placeholder="cliente@correo.com" autoComplete="email" required value={correo} onChange={e => { setCorreo(e.target.value); setComprador(null); setViajes(null); sessionStorage.removeItem("rutaec:comprador-ventanilla") }} /></label><button className="btn btn-oscuro" disabled={ocupado}>{ocupado ? "Consultando…" : "Buscar cliente"}</button></form>
      {comprador && <p className="comprador-verificado" role="status"><strong>Comprador encontrado: </strong>{comprador.nombres} {comprador.apellidos} · {comprador.correo}</p>}
    </section>
    <section className="panel"><h2>Salidas disponibles</h2><form className="form-fila" onSubmit={buscarViajes}>
      <label>Origen<input placeholder="Ciudad de origen" required value={origen} onChange={e => setOrigen(e.target.value)} /></label><label>Destino<input placeholder="Ciudad de destino" required value={destino} onChange={e => setDestino(e.target.value)} /></label><label>Fecha<input type="date" required value={fecha} onChange={e => setFecha(e.target.value)} /></label><label>Pasajeros<input type="number" min={1} max={10} required value={n} onChange={e => setN(Number(e.target.value))} /></label><button className="btn btn-acento" title={!comprador ? "Selecciona un comprador" : undefined} disabled={ocupado || !comprador}>{ocupado ? "Consultando…" : "Buscar salidas"}</button>
    </form>
    {viajes?.length === 0 && <div className="estado-vacio" role="status"><strong>No encontramos salidas para ese recorrido</strong><p>Prueba otra fecha o confirma con el gerente qué viajes están publicados.</p></div>}
    {viajes?.map(v => <article className="panel" key={v.viaje_id}><p>{v.origen_terminal} → {v.destino_terminal} · {new Date(v.salida).toLocaleString('es-EC')} · {v.cupos_disponibles} disponibles</p><button className="btn btn-oscuro" disabled={!comprador} onClick={() => nav(urlCompra(v.viaje_id,{origen,destino,fecha,pasajeros:n}))}>Elegir asientos</button></article>)}
    </section>
  </div>
}
