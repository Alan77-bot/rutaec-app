import { useState } from 'react'

export default function NavegacionPanel({ opciones, activa, onChange }) {
  const [busqueda, setBusqueda] = useState('')
  const visibles = opciones.filter(o => o.titulo.toLocaleLowerCase('es').includes(busqueda.toLocaleLowerCase('es')))
  return <section className="navegacion-panel navegacion-compacta" aria-label="Secciones del panel">
    <div className="navegacion-panel-cab"><h2>Panel de gestión</h2><label className="buscar-seccion"><span className="solo-lectores">Buscar apartado</span><input type="search" placeholder="Buscar apartado…" value={busqueda} onChange={e => setBusqueda(e.target.value)} /></label></div>
    <nav className="navegacion-panel-grid" aria-label="Apartados">
      {visibles.map(o => <button type="button" key={o.id} className={`navegacion-tarea ${activa === o.id ? 'seleccionada' : ''}`} aria-current={activa === o.id ? 'page' : undefined} onClick={() => onChange(o.id)}><span className="tarea-simbolo" aria-hidden="true">{o.icono}</span><strong>{o.titulo}</strong></button>)}
    </nav>
    {visibles.length === 0 && <p role="status">Sin resultados. <button type="button" className="btn-link" onClick={() => setBusqueda('')}>Mostrar todos</button></p>}
  </section>
}
