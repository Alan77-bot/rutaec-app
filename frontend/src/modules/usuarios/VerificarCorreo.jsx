import { useEffect, useState } from 'react'
import { usuariosService } from './services/usuarios.service'

export default function VerificarCorreo({
  pendiente,
  onVerificado,
  onVolver,
}) {
  const [correo, setCorreo] = useState(pendiente?.correo ?? '')
  const [clave, setClave] = useState(pendiente?.clave ?? '')
  const [verificacionId, setVerificacionId] = useState(
    pendiente?.verificacionId ?? ''
  )
  const [venceEn, setVenceEn] = useState(pendiente?.venceEn ?? '')
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const [reenvioEn, setReenvioEn] = useState(
    pendiente?.verificacionId ? Date.now() + 60000 : 0
  )

  const [ahora, setAhora] = useState(Date.now())

  useEffect(() => {
    const intervalo = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(intervalo)
  }, [])

  const espera = Math.max(0, Math.ceil((reenvioEn - ahora) / 1000))

  const vencido = Boolean(
    venceEn && new Date(venceEn).getTime() <= ahora
  )

  function validarDatos() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())) {
      setError('Escribe el correo con el que te registraste.')
      return false
    }

    if (!clave) {
      setError('Escribe la contraseña que elegiste al registrarte.')
      return false
    }

    return true
  }

  async function verificar(evento) {
    evento.preventDefault()

    if (ocupado) return

    setError('')
    setMensaje('')

    if (!validarDatos()) return

    if (!verificacionId) {
      setError('Primero solicita un código.')
      return
    }

    if (!/^\d{6}$/.test(codigo)) {
      setError('Escribe los seis dígitos del código.')
      return
    }

    if (vencido) {
      setError('El código venció. Solicita uno nuevo.')
      return
    }

    setOcupado(true)

    try {
      await usuariosService.verificarCorreo(
        verificacionId,
        codigo,
        clave
      )

      setClave('')
      setCodigo('')
      onVerificado(correo)
    } catch (err) {
      setError(err.message ?? 'No se pudo verificar el correo.')
    } finally {
      setOcupado(false)
    }
  }

  async function reenviar() {
    if (ocupado || espera > 0) return

    setError('')
    setMensaje('')

    if (!validarDatos()) return

    setOcupado(true)

    try {
      const respuesta = await usuariosService.reenviarCodigo(
        correo.trim(),
        clave
      )

      setCorreo(respuesta.correo)
      setVerificacionId(respuesta.verificacionId)
      setVenceEn(respuesta.venceEn)
      setCodigo('')
      setReenvioEn(Date.now() + 60000)
      setAhora(Date.now())
      setMensaje('Código enviado. Revisa tu bandeja de entrada y spam.')
    } catch (err) {
      setError(err.message ?? 'No se pudo enviar el código.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <form
      onSubmit={verificar}
      className="auth-campos"
      aria-busy={ocupado}
      noValidate
    >
      <h2>Verificar correo</h2>

      <p className="muted">
        {verificacionId
          ? 'Introduce el código que enviamos a tu correo.'
          : 'Introduce los datos de tu cuenta pendiente para solicitar un nuevo código.'}
      </p>

      <label className="campo">
        <span>Correo electrónico</span>
        <input
          type="email"
          autoComplete="email"
          value={correo}
          maxLength={254}
          readOnly={Boolean(verificacionId)}
          disabled={ocupado}
          onChange={(evento) => setCorreo(evento.target.value)}
          required
        />
      </label>

      <label className="campo">
        <span>Contraseña de tu cuenta RutaEC</span>
        <input
          type="password"
          autoComplete="current-password"
          value={clave}
          disabled={ocupado}
          onChange={(evento) => setClave(evento.target.value)}
          required
        />
      </label>

      {verificacionId && (
        <>
          <label className="campo">
            <span>Código de seis dígitos</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={codigo}
              disabled={ocupado}
              onChange={(evento) => {
                setCodigo(evento.target.value.replace(/\D/g, '').slice(0, 6))
                setError('')
              }}
              required
            />
          </label>

          <p className="auth-nota">
            {vencido
              ? 'El código venció. Solicita uno nuevo.'
              : `Vence: ${new Date(venceEn).toLocaleString('es-EC')}`}
          </p>

          <button
            type="submit"
            className="btn btn-oscuro btn-lg ancho"
            disabled={ocupado || vencido}
          >
            {ocupado ? 'Procesando...' : 'Verificar correo'}
          </button>
        </>
      )}

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
        type="button"
        className="btn-link"
        onClick={reenviar}
        disabled={ocupado || espera > 0}
      >
        {espera > 0
          ? `Solicitar otro código en ${espera}s`
          : 'Enviar un nuevo código'}
      </button>

      <button
        type="button"
        className="btn-link"
        onClick={onVolver}
        disabled={ocupado}
      >
        Volver al inicio de sesión
      </button>
    </form>
  )
}