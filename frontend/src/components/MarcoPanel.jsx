import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { usePersonalizacion } from '../context/PersonalizacionContext'
import { ROLES } from '../data/usuarios'
import { navegacionPorRol, enlaceActivo } from '../data/navegacion'
import { inicioPorRol } from '../data/acceso'
import Navbar from './Navbar'
import Icon from './Icon'
import Dialogo from './ui/Dialogo'
import '../styles/sidebar.css'

export default function MarcoPanel({ children }) {
  const { sesion, config } = useApp()
  const { cooperativa, cooperativaId } = usePersonalizacion()
  const loc = useLocation()
  const [movil, setMovil] = useState(false)
  const [compacta, setCompacta] = useState(false)
  useEffect(() => { setMovil(false) }, [loc.pathname, loc.search])
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1051px)')
    const cerrar = () => { if (media.matches) setMovil(false) }
    media.addEventListener('change', cerrar)
    return () => media.removeEventListener('change', cerrar)
  }, [])
  if (!sesion) return <><Navbar />{children}</>
  const nombreMarca = cooperativa?.nombre || (cooperativaId ? 'Mi cooperativa' : config.nombre)
  const fotoMarca = cooperativaId ? cooperativa?.logo || cooperativa?.fotografia : config.logo
  const color = cooperativa?.color_primario || cooperativa?.color || config.color || '#1b3f68'
  const rgb = /^#[a-f0-9]{6}$/i.test(color) ? color.slice(1).match(/../g).map(v => parseInt(v, 16) / 255) : [0, 0, 0]
  const luminancia = rgb.map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0)
  const temaLateral = { '--lateral-color': color, '--lateral-texto': luminancia > .35 ? '#172033' : '#FFFFFF' }
  const grupos = navegacionPorRol(sesion.rol)
  const contenido = (esMovil = false) => <>
    <div className="lateral-marca">
      <Link to={inicioPorRol(sesion.rol)} title={nombreMarca}>
        {fotoMarca ? <img src={fotoMarca} alt={`Imagen de ${nombreMarca}`} /> : <Icon n="bus" size={30} />}
        <span>{nombreMarca}</span>
      </Link>
      {esMovil && <button type="button" aria-label="Cerrar menú" onClick={() => setMovil(false)}><Icon n="x" /></button>}
    </div>
    <Link className="lateral-persona" to="/perfil" title={sesion.nombre}>
      <span className="lateral-avatar">{sesion.nombre?.[0]}</span>
      <span><small>{ROLES[sesion.rol]}</small><strong>{sesion.nombre}</strong></span>
    </Link>
    <nav className="lateral-opciones" aria-label="Navegación principal">
      {grupos.map(g => <section key={g.titulo}><h2>{g.titulo === 'Mi cooperativa' ? nombreMarca : g.titulo}</h2>{g.opciones.map(o => {
        const activa = enlaceActivo(o.to, loc.pathname, loc.search)
        return <Link key={o.to} to={o.to} className={'lateral-enlace' + (activa ? ' activo' : '')} aria-current={activa ? 'page' : undefined} title={o.titulo}>
          {o.id ? <span className="lateral-simbolo" aria-hidden="true">{o.icono}</span> : <Icon n={o.icono} />}<span>{o.titulo}</span>
        </Link>
      })}</section>)}
    </nav>
    {!esMovil && <button type="button" className="lateral-plegar" onClick={() => setCompacta(v => !v)} aria-label={compacta ? 'Expandir barra lateral' : 'Contraer barra lateral'} aria-expanded={!compacta}><span aria-hidden="true">{compacta ? '»' : '«'}</span><span>Contraer menú</span></button>}
  </>
  return <div style={temaLateral} className={'marco-panel' + (compacta ? ' lateral-compacta' : '')}>
    <aside className="barra-lateral">{contenido()}</aside>
    <div className="marco-contenido"><Navbar panel onAbrirMenu={() => setMovil(true)} />{children}</div>
    {movil && <Dialogo overlayProps={{ className: 'lateral-fondo', style: temaLateral, onMouseDown: e => { if (e.target === e.currentTarget) setMovil(false) } }} panelProps={{ className: 'lateral-dialogo', 'aria-label': 'Menú principal' }}>{contenido(true)}</Dialogo>}
  </div>
}
