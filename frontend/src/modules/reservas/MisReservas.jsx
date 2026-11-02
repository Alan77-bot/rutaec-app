import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

export default function MisReservas() {
  const [lista, setLista] = useState(null)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  useEffect(() => {
    const control = new AbortController()
    fetch('/api/reservas/mias', { credentials: 'include', signal: control.signal }).then(async r => {
      const b = await r.json(); if (!r.ok) throw new Error(b.error ?? 'No se pudieron cargar las reservas.'); return b.datos
    }).then(setLista).catch(e => { if (e.name !== 'AbortError') setError(e.message) })
    return () => control.abort()
  }, [version])
  return <div className="contenedor"><h1>Mis reservas</h1>
    {error && <p role="alert">{error}</p>}
    <button className="btn btn-claro" onClick={() => { setError(''); setVersion(v => v + 1) }}>Actualizar</button>
    {!lista && !error && <p role="status">Cargando…</p>}
    {lista?.length === 0 && <p>No hay reservas.</p>}
    {lista?.map(c => <article className="panel" key={c.id}><Link to={`/reserva/${c.id}`}>Reserva {c.id.slice(0,8)}</Link><p>{c.estado} · {c.moneda} {c.total}</p></article>)}
  </div>
}
