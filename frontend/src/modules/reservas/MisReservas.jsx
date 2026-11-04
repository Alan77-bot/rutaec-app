import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

export default function MisReservas() {
  const [lista, setLista] = useState(null)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  const [filtro, setFiltro] = useState('')
  const [busqueda, setBusqueda] = useState('')
  useEffect(() => {
    const control = new AbortController()
    fetch('/api/reservas/mias', { credentials: 'include', signal: control.signal }).then(async r => {
      const b = await r.json(); if (!r.ok) throw new Error(b.error ?? 'No se pudieron cargar las reservas.'); return b.datos
    }).then(setLista).catch(e => { if (e.name !== 'AbortError') setError(e.message) })
    return () => control.abort()
  }, [version])
  const etiquetas = { CONFIRMADA: 'Confirmada', PENDIENTE: 'Pendiente', PENDIENTE_PAGO: 'Pendiente de pago', EN_REVISION: 'En revisión', CANCELADA: 'Cancelada', EXPIRADA: 'Vencida', RESERVADA: 'Reservada' }
  const visibles = lista?.filter(c => (!filtro || c.estado === filtro) && `${c.id} ${etiquetas[c.estado] ?? c.estado}`.toLowerCase().includes(busqueda.toLowerCase()))
  return <div className="contenedor reservas-mejoradas"><div className="cabecera-acciones"><h1>Mis reservas</h1><Link className="btn btn-oscuro" to="/">Buscar viajes</Link></div>
    <div className="barra-filtros"><label>Buscar reserva<input type="search" placeholder="Número o estado…" value={busqueda} onChange={e => setBusqueda(e.target.value)} /></label><label>Estado<select value={filtro} onChange={e => setFiltro(e.target.value)}><option value="">Todos los estados</option>{[...new Set(lista?.map(c => c.estado) ?? [])].map(estado => <option key={estado} value={estado}>{etiquetas[estado] ?? estado.replaceAll('_',' ')}</option>)}</select></label><Link className="btn btn-claro" to="/descuentos">Descuentos</Link></div>
    {error && <p role="alert">{error}</p>}
    <button className="btn btn-claro" onClick={() => { setError(''); setVersion(v => v + 1) }}>Actualizar</button>
    {!lista && !error && <p role="status">Cargando…</p>}
    {visibles?.length === 0 && <div className="estado-vacio"><strong>{lista?.length ? 'Sin coincidencias' : 'Todavía no tienes reservas'}</strong>{lista?.length > 0 && <button className="btn btn-claro" onClick={() => { setBusqueda(''); setFiltro('') }}>Limpiar filtros</button>}</div>}
    <div className="reservas-grid">{visibles?.map(c => <article className="panel reserva-tarjeta" key={c.id}><div className="cabecera-acciones"><strong>#{c.id.slice(0,8).toUpperCase()}</strong><span className={'badge ' + (c.estado === 'CONFIRMADA' ? 'verde' : ['CANCELADA','EXPIRADA'].includes(c.estado) ? 'gris' : '')}>{etiquetas[c.estado] ?? c.estado.replaceAll('_',' ')}</span></div><strong className="reserva-importe">{c.moneda} {Number(c.total).toFixed(2)}</strong><Link className="btn btn-claro" to={`/reserva/${c.id}`}>Ver reserva →</Link></article>)}</div>
  </div>
}
