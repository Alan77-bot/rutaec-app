import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import Icon from './Icon'
import VisorCorreo from './VisorCorreo'
import { ROLES } from '../data/usuarios'
import { usePersonalizacion } from '../context/PersonalizacionContext'
import { esPersonal, inicioPorRol } from '../data/acceso'

export default function Navbar({ panel = false, onAbrirMenu }) {
  const { sesion, cerrarSesion, config, correos, marcarLeidos } = useApp()
  const { cooperativa, cooperativaId } = usePersonalizacion()
  const nombreMarca = cooperativa?.nombre || (cooperativaId ? 'Mi cooperativa' : config.nombre)
  const fotoMarca = cooperativaId ? cooperativa?.logo || cooperativa?.fotografia : config.logo
  const [abierto, setAbierto] = useState(false)
  const [menu, setMenu] = useState(false)
  const [scroll, setScroll] = useState(false)
  const [ver, setVer] = useState(null)
  const nav = useNavigate()
  const [saliendo, setSaliendo] = useState(false)

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

   const salir = async () => {
    if (saliendo) return

    setSaliendo(true)

    try {
      const cerrado = await cerrarSesion()

      if (!cerrado) return

      setMenu(false)
      setAbierto(false)
      nav('/ingresar', { replace: true })
    } finally {
      setSaliendo(false)
    }
  }

  return (
    <>
    <header className={'navbar' + (panel ? ' navbar-panel' : '') + (scroll ? ' sombra' : '')}>
      <div className="navbar-in">
        {panel && <button type="button" className="lateral-abrir" onClick={onAbrirMenu} aria-label="Abrir menú principal"><span aria-hidden="true">☰</span></button>}
        <Link to="/" className="marca">
          {fotoMarca ? <img src={fotoMarca} alt={`Imagen de ${nombreMarca}`} className="marca-logo" /> : <span className="marca-logo-app" aria-hidden="true" />}
          <span className="marca-nombre" title={nombreMarca}>{nombreMarca}</span>
        </Link>

        {!panel && <button className="burger" onClick={() => setMenu(!menu)} aria-label="Menú" aria-expanded={menu}><Icon n={menu ? 'x' : 'route'} /></button>}

        {!panel && <nav className={'links' + (menu ? ' abierto' : '')} onClick={() => setMenu(false)}>
          <NavLink to={inicioPorRol(sesion?.rol)} end>{sesion?.rol === 'admin' ? 'Administración' : sesion?.rol === 'cooperativa' ? 'Mi cooperativa' : sesion?.rol === 'oficinista' ? 'Ventanilla' : 'Buscar viajes'}</NavLink>
          {sesion && <NavLink to="/perfil">Mi perfil</NavLink>}
          {["cooperativa","oficinista"].includes(sesion?.rol) && <NavLink to="/revisiones">Revisiones</NavLink>}
          {(!sesion || sesion.rol === 'usuario') && <NavLink to="/mis-viajes">Mis viajes</NavLink>}
          {sesion?.rol === 'cooperativa' && <NavLink to="/cancelacion-viajes">Cancelar viajes</NavLink>}
          {['cooperativa','oficinista'].includes(sesion?.rol) && <NavLink to="/reporte-operativo">Reportes</NavLink>}
          {sesion && ["usuario", "oficinista"].includes(sesion.rol) && <NavLink to="/mis-reservas">Reservas</NavLink>}
        </nav>}

        <div className="nav-der">
          <div className="campana-wrap">
            <button className="campana" onClick={alternar} aria-label="Notificaciones" aria-expanded={abierto}>
              <Icon n="bell" size={18} />
              {noLeidos > 0 && <i>{noLeidos}</i>}
            </button>
            {abierto && (
              <div className="cajon">
                <h4>Notificaciones</h4>
                {!sesion && <p className="vacio-sm">Inicia sesión para ver tus notificaciones.</p>}
                {sesion && correos.length === 0 && <p className="vacio-sm">Aún no tienes notificaciones.</p>}
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
              <button
                onClick={salir}
                className="btn-link"
                disabled={saliendo}
              >
                {saliendo ? 'Cerrando...' : 'Salir'}
              </button>
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


