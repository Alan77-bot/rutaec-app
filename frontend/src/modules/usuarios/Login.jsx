import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import Icon from '../../components/Icon'
import { RUTA_POR_ROL } from '../../data/usuarios'

export default function Login() {
  const { sesion, cargando, iniciarSesion, avisar, config } = useApp()

  const nav = useNavigate()
  const loc = useLocation()

  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [verClave, setVerClave] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  const destinoSolicitado = loc.state?.from

  const destinoSeguro =
    typeof destinoSolicitado === 'string' &&
    destinoSolicitado.startsWith('/') &&
    !destinoSolicitado.startsWith('//') &&
    !destinoSolicitado.includes('\\') &&
    !destinoSolicitado.startsWith('/ingresar')
      ? destinoSolicitado
      : null

  function rutaInicial(usuario) {
    if (usuario.rol === 'usuario' && destinoSeguro) {
      return destinoSeguro
    }

    return RUTA_POR_ROL[usuario.rol] ?? '/'
  }

  async function entrar(evento) {
    evento.preventDefault()

    if (enviando) return

    setError('')

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())) {
      setError('Escribe un correo electrónico válido.')
      return
    }

    if (!clave) {
      setError('Escribe tu contraseña.')
      return
    }

    setEnviando(true)

    try {
      const resultado = await iniciarSesion(correo.trim(), clave)

      if (!resultado.ok) {
        setError(resultado.error)
        return
      }

      setClave('')
      avisar(`Bienvenido, ${resultado.sesion.nombre}`)
      nav(rutaInicial(resultado.sesion), { replace: true })
    } finally {
      setEnviando(false)
    }
  }

  if (cargando) {
    return <p role="status">Comprobando sesión...</p>
  }

  if (sesion) {
    return <Navigate to={rutaInicial(sesion)} replace />
  }

  return (
    <div className="auth">
      <aside
        className="auth-lado"
        style={{ backgroundImage: 'url(/img/bus-azul.jpg)' }}
      >
        <div className="auth-velo" />

        <div className="auth-lado-in">
          <p className="etiqueta">{config.nombre}</p>

          <h2>Tu próximo viaje empieza aquí.</h2>

          <p>
            Compra pasajes de las cooperativas interprovinciales,
            elige tu asiento y lleva el boleto en el celular.
          </p>

          <ul className="auth-lista">
            <li>
              <Icon n="shield" />
              Accede con tu cuenta
            </li>
            <li>
              <Icon n="qr" />
              Consulta tus boletos
            </li>
            <li>
              <Icon n="mail" />
              Mantén tus datos en un solo lugar
            </li>
          </ul>
        </div>
      </aside>

      <section className="auth-form">
        <div className="auth-card">
          <h2>Iniciar sesión</h2>
          <p className="muted">Ingresa con tu correo y contraseña.</p>

          {destinoSeguro && (
            <p className="auth-aviso">
              Inicia sesión para continuar.
            </p>
          )}

          <form
            onSubmit={entrar}
            className="auth-campos"
            aria-busy={enviando}
          >
            <label className="campo">
              <span>Correo electrónico</span>

              <input
                type="email"
                name="correo"
                autoComplete="username"
                placeholder="tucorreo@ejemplo.com"
                value={correo}
                onChange={(evento) => {
                  setCorreo(evento.target.value)
                  setError('')
                }}
                maxLength={254}
                disabled={enviando}
                required
              />
            </label>

            <label className="campo">
              <span>Contraseña</span>

              <input
                type={verClave ? 'text' : 'password'}
                name="clave"
                autoComplete="current-password"
                placeholder="Tu contraseña"
                value={clave}
                onChange={(evento) => {
                  setClave(evento.target.value)
                  setError('')
                }}
                disabled={enviando}
                required
              />

              <button
                type="button"
                className="btn-link"
                onClick={() => setVerClave(!verClave)}
                aria-pressed={verClave}
              >
                {verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              </button>
            </label>

            <Link to="/recuperar-contrasena" className="btn-link">
              ¿Olvidaste tu contraseña?
            </Link>

            {error && (
              <p role="alert" className="auth-aviso">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="btn btn-oscuro btn-lg ancho"
              disabled={enviando}
            >
              {enviando ? 'Ingresando...' : 'Ingresar'}
              <Icon n="arrow" size={18} />
            </button>

            <p className="auth-nota">
              El registro de nuevas cuentas se habilitará al integrar
              el módulo de registro.
            </p>
          </form>
        </div>
      </section>
    </div>
  )
}