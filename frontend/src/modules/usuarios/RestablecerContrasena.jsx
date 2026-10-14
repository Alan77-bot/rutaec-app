import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { usuariosService } from './services/usuarios.service'

export default function RestablecerContrasena() {
  const loc = useLocation()
  const nav = useNavigate()
  const { reintentar } = useApp()

  const [token, setToken] = useState(() => {
    const parametros = new URLSearchParams(loc.hash.slice(1))
    const valor = parametros.get('token') ?? ''

    return /^[a-f0-9]{64}$/.test(valor) ? valor : ''
  })

  const [nuevaClave, setNuevaClave] = useState('')
  const [confirmarClave, setConfirmarClave] = useState('')
  const [mostrarClave, setMostrarClave] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [completado, setCompletado] = useState(false)

  useEffect(() => {
    if (!loc.hash) return

    nav(
      {
        pathname: loc.pathname,
        search: loc.search,
        hash: '',
      },
      { replace: true }
    )
  }, [loc.hash, loc.pathname, loc.search, nav])

  async function guardar(evento) {
    evento.preventDefault()

    if (enviando) return

    setError('')

    if (!token) {
      setError('El enlace no es válido. Solicita uno nuevo.')
      return
    }

    if (
      nuevaClave.length < 12 ||
      new TextEncoder().encode(nuevaClave).length > 72
    ) {
      setError(
        'La contraseña debe tener al menos 12 caracteres y hasta 72 bytes.'
      )
      return
    }

    if (nuevaClave !== confirmarClave) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setEnviando(true)

    try {
      await usuariosService.restablecerContrasena(
        token,
        nuevaClave,
        confirmarClave
      )

      setToken('')
      setNuevaClave('')
      setConfirmarClave('')
      setCompletado(true)
    } catch (err) {
      setError(err.message ?? 'No se pudo actualizar la contraseña.')
    } finally {
      setEnviando(false)
    }
  }

  async function irAlLogin() {
    // Actualiza el contexto después de revocar la sesión del navegador.
    await reintentar()
    nav('/ingresar', { replace: true })
  }

  if (completado) {
    return (
      <section className="auth-form">
        <div className="auth-card">
          <h1>Contraseña actualizada</h1>

          <p role="status">
            Tus sesiones anteriores quedaron invalidadas.
            Inicia sesión con la nueva contraseña.
          </p>

          <button
            type="button"
            className="btn btn-oscuro"
            onClick={irAlLogin}
          >
            Ir al inicio de sesión
          </button>
        </div>
      </section>
    )
  }

  if (!token) {
    return (
      <section className="auth-form">
        <div className="auth-card">
          <h1>Enlace no disponible</h1>

          <p role="alert">
            Abre el enlace completo que recibiste por correo
            o solicita uno nuevo.
          </p>

          <Link to="/recuperar-contrasena" className="btn btn-oscuro">
            Solicitar otro enlace
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="auth-form">
      <div className="auth-card">
        <h1>Crear nueva contraseña</h1>

        <p className="muted">
          Escribe una contraseña de al menos 12 caracteres.
        </p>

        <form
          onSubmit={guardar}
          className="auth-campos"
          aria-busy={enviando}
        >
          <label className="campo" htmlFor="nueva-clave">
            <span>Nueva contraseña</span>

            <input
              id="nueva-clave"
              type={mostrarClave ? 'text' : 'password'}
              autoComplete="new-password"
              value={nuevaClave}
              onChange={(evento) => setNuevaClave(evento.target.value)}
              disabled={enviando}
              required
            />
          </label>

          <label className="campo" htmlFor="confirmar-clave">
            <span>Confirmar contraseña</span>

            <input
              id="confirmar-clave"
              type={mostrarClave ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmarClave}
              onChange={(evento) => setConfirmarClave(evento.target.value)}
              disabled={enviando}
              required
            />
          </label>

          <button
            type="button"
            className="btn-link"
            onClick={() => setMostrarClave((actual) => !actual)}
            aria-pressed={mostrarClave}
          >
            {mostrarClave ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}
          </button>

          {error && (
            <p className="auth-aviso" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-oscuro btn-lg ancho"
            disabled={enviando}
          >
            {enviando ? 'Guardando...' : 'Guardar contraseña'}
          </button>

          <Link to="/recuperar-contrasena" className="btn-link">
            Solicitar otro enlace
          </Link>
        </form>
      </div>
    </section>
  )
}