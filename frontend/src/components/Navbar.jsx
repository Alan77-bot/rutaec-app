import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import Icon from './Icon'
import VisorCorreo from './VisorCorreo'
import { ROLES } from '../data/usuarios'

export default function Navbar() {
  const { sesion, cerrarSesion, config, correos, marcarLeidos } = useApp()
  const [abierto, setAbierto] = useState(false)
  const [menu, setMenu] = useState(false)
  const [scroll, setScroll] = useState(false)
  const [ver, setVer] = useState(null)
  const nav = useNavigate()

  useEffect(() => {
    const f = () => setScroll(window.scrollY > 12)
    f()
    window.addEventListener('scroll', f, { passive: true })
    return () => window.removeEventListener('scroll', f)
  }, [])

  const noLeidos = sesion ? correos.filter((c) => c.para === sesion.correo && !c.leido).length : 0

  const alternar = () => {
    if (!abierto) marcarLeidos()
    setAbierto(!abierto)
  }
  const abrirCorreo = (c) => {
    setVer(c)
    setAbierto(false)
  }

  const salir = () => {
    cerrarSesion()
    setMenu(false)
    setAbierto(false)
    nav('/')
  }

  return (
    <>
    <header className={'navbar' + (scroll ? ' sombra' : '')}>
      <div className="navbar-in">
        <Link to="/" className="marca">
          {config.logo ? <img src={config.logo} alt="" className="marca-logo" /> : <span className="marca-logo-app" aria-hidden="true" />}
          <span>{config.nombre}</span>
        </Link>

        <button className="burger" onClick={() => setMenu(!menu)} aria-label="MenÃº"><Icon n={menu ? 'x' : 'route'} /></button>

        <nav className={'links' + (menu ? ' abierto' : '')} onClick={() => setMenu(false)}>
          <NavLink to="/" end>Inicio</NavLink>
          {(!sesion || sesion.rol === 'usuario') && <NavLink to="/mis-viajes">Mis viajes</NavLink>}
          {sesion?.rol === 'oficinista' && <NavLink to="/oficinista">Ventanilla</NavLink>}
          {sesion?.rol === 'cooperativa' && <NavLink to="/cooperativa">Mi cooperativa</NavLink>}
          {sesion?.rol === 'admin' && <NavLink to="/admin">AdministraciÃ³n</NavLink>}
        </nav>

        <div className="nav-der">
          <div className="campana-wrap">
            <button className="campana" onClick={alternar} aria-label="Notificaciones">
              <Icon n="bell" size={18} />
              {noLeidos > 0 && <i>{noLeidos}</i>}
            </button>
            {abierto && (
              <div className="cajon">
                <h4>Notificaciones</h4>
                {!sesion && <p className="vacio-sm">Inicia sesiÃ³n para ver tus notificaciones.</p>}
                {sesion && correos.length === 0 && <p className="vacio-sm">AÃºn no tienes notificaciones.</p>}
                {correos.map((c) => (
                  <button key={c.id} className="correo" onClick={() => abrirCorreo(c)}>
                    <b>{c.asunto}</b>
                    <span>{c.para === sesion?.correo ? 'Para ti' : `Enviado a ${c.para}`}</span>
                    <time>{new Date(c.hora).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}</time>
                  </button>
                ))}
              </div>
            )}
          </div>
          {sesion ? (
            <div className="chip-user">
              <span className="avatar">{sesion.nombre[0]}</span>
              <div>
                <b>{sesion.nombre}</b>
                <small>{ROLES[sesion.rol]}</small>
              </div>
              <button onClick={salir} className="btn-link">Salir</button>
            </div>
          ) : (
            <Link to="/ingresar" className="btn btn-oscuro">Ingresar</Link>
          )}
        </div>
      </div>
    </header>
    <VisorCorreo correo={ver} onCerrar={() => setVer(null)} nombreApp={config.nombre} />
    </>
  )
}


