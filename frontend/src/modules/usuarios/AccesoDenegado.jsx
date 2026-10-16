import { Link } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { RUTA_POR_ROL } from '../../data/usuarios'

export default function AccesoDenegado() {
  const { sesion } = useApp()

  const destino = sesion
    ? RUTA_POR_ROL[sesion.rol] ?? '/'
    : '/ingresar'

  return (
    <section className="auth-form" aria-labelledby="titulo-acceso">
      <div className="auth-card">
        <p className="etiqueta">Acceso restringido</p>

        <h1 id="titulo-acceso">Acceso denegado</h1>

        <p>
          Tu cuenta no tiene permisos para acceder a esta sección.
        </p>

        <Link to={destino} className="btn btn-oscuro">
          {sesion ? 'Volver a mi sección' : 'Iniciar sesión'}
        </Link>
      </div>
    </section>
  )
}