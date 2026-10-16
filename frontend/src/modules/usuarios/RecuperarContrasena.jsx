import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usuariosService } from './services/usuarios.service'

export default function RecuperarContrasena() {
  const [correo, setCorreo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  async function enviar(evento) {
    evento.preventDefault()

    if (enviando) return

    setError('')
    setMensaje('')

    const correoLimpio = correo.trim()

    if (
      correoLimpio.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoLimpio)
    ) {
      setError('Escribe un correo electrónico válido.')
      return
    }

    setEnviando(true)

    try {
      const respuesta = await usuariosService.solicitarRecuperacion(
        correoLimpio
      )

      setMensaje(respuesta.mensaje)
    } catch (err) {
      setError(err.message ?? 'No se pudo completar la solicitud.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className="auth-form">
      <div className="auth-card">
        <h1>Recuperar contraseña</h1>

        <p className="muted">
          Escribe el correo de tu cuenta para solicitar un enlace
          de recuperación.
        </p>

        <form
          onSubmit={enviar}
          className="auth-campos"
          aria-busy={enviando}
        >
          <label className="campo" htmlFor="recuperar-correo">
            <span>Correo electrónico</span>

            <input
              id="recuperar-correo"
              type="email"
              autoComplete="email"
              value={correo}
              onChange={(evento) => {
                setCorreo(evento.target.value)
                setError('')
                setMensaje('')
              }}
              maxLength={254}
              disabled={enviando}
              required
            />
          </label>

          {error && (
            <p className="auth-aviso" role="alert">
              {error}
            </p>
          )}

          {mensaje && (
            <p className="auth-aviso" role="status">
              {mensaje}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-oscuro btn-lg ancho"
            disabled={enviando}
          >
            {enviando ? 'Procesando...' : 'Solicitar enlace'}
          </button>

          <Link to="/ingresar" className="btn-link">
            Volver al inicio de sesión
          </Link>
        </form>
      </div>
    </section>
  )
}