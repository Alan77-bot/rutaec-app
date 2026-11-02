import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { urlCompra } from '../reservas/reservas.enlaces'

export default function PanelVentanilla() {
  const { sesion } = useApp()
  const nav = useNavigate()
  const [correo, setCorreo] = useState('')
  const [comprador, setComprador] = useState(null)
  const [origen, setOrigen] = useState('')
  const [destino, setDestino] = useState('')
  const [fecha, setFecha] = useState('')
  const [n, setN] = useState(1)
  const [viajes, setViajes] = useState(null)
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  useEffect(() => { sessionStorage.removeItem('rutaec:comprador-ventanilla') }, [])
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
  return <div className="contenedor"><h1>Ventanilla</h1><p>Venta de viajes de tu cooperativa, con la misma disponibilidad y reserva que usa el cliente.</p>
    <div className="acciones"><Link className="btn btn-claro" to="/revisiones">Revisar pagos y descuentos</Link><Link className="btn btn-claro" to="/mis-reservas">Reservas y ventas</Link><Link className="btn btn-claro" to="/incidencias">Incidencias y reembolsos</Link></div>
    {error && <p className="auth-aviso" role="alert">{error}</p>}
    <section className="panel"><h2>Comprador</h2><p>Esta versión utiliza la cuenta verificada del comprador. No se crean cuentas ficticias ni se registra una venta a nombre del oficinista.</p>
      <form onSubmit={buscarComprador}><label>Correo del comprador<input type="email" required value={correo} onChange={e => setCorreo(e.target.value)} /></label><button className="btn btn-oscuro" disabled={ocupado}>Consultar comprador</button></form>
      {comprador && <p role="status">{comprador.nombres} {comprador.apellidos} · {comprador.correo}</p>}
    </section>
    <section className="panel"><h2>Buscar viaje</h2><form className="form-fila" onSubmit={buscarViajes}>
      <label>Origen<input required value={origen} onChange={e => setOrigen(e.target.value)} /></label><label>Destino<input required value={destino} onChange={e => setDestino(e.target.value)} /></label><label>Fecha<input type="date" required value={fecha} onChange={e => setFecha(e.target.value)} /></label><label>Pasajeros<input type="number" min={1} max={10} required value={n} onChange={e => setN(Number(e.target.value))} /></label><button className="btn btn-acento" disabled={ocupado || !comprador}>Buscar</button>
    </form>
    {viajes?.length === 0 && <p>No hay salidas de tu cooperativa para esa búsqueda.</p>}
    {viajes?.map(v => <article className="panel" key={v.viaje_id}><p>{v.origen_terminal} → {v.destino_terminal} · {new Date(v.salida).toLocaleString('es-EC')} · {v.cupos_disponibles} disponibles</p><button className="btn btn-oscuro" disabled={!comprador} onClick={() => nav(urlCompra(v.viaje_id,{origen,destino,fecha,pasajeros:n}))}>Elegir asientos</button></article>)}
    </section><p className="muted">Métodos: depósito, transferencia y tarjeta de demostración cuando se habilite. No se incluye efectivo.</p>
  </div>
}
