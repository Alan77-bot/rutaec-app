import { useState } from 'react'

const INICIAL = {
  nombres: '',
  apellidos: '',
  numero_documento: '',
  telefono: '',
  correo: '',
  clave: '',
  confirmarClave: '',
}

export default function RegistroForm({ onRegistrar, onVolver }) {
  const [datos, setDatos] = useState(INICIAL)
  const [errores, setErrores] = useState({})
  const [enviando, setEnviando] = useState(false)
  const [mostrarClave, setMostrarClave] = useState(false)

  function cambiar(evento) {
    const { name, value } = evento.target

    setDatos((actual) => ({
      ...actual,
      [name]: value,
    }))

    setErrores((actual) => ({
      ...actual,
      [name]: '',
      general: '',
    }))
  }

  function validar() {
    const nuevos = {}

    if (!datos.nombres.trim()) {
      nuevos.nombres = 'Escribe tus nombres.'
    }

    if (!datos.apellidos.trim()) {
      nuevos.apellidos = 'Escribe tus apellidos.'
    }

    if (!/^\d{10}$/.test(datos.numero_documento.trim())) {
      nuevos.numero_documento = 'Escribe una cédula de 10 dígitos.'
    }

    if (!/^09\d{8}$/.test(datos.telefono.trim())) {
      nuevos.telefono = 'Escribe un celular ecuatoriano de 10 dígitos.'
    }

    if (
      datos.correo.trim().length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.correo.trim())
    ) {
      nuevos.correo = 'Escribe un correo válido.'
    }

    if (datos.clave.length < 12) {
      nuevos.clave = 'La contraseña debe tener al menos 12 caracteres.'
    } else if (new TextEncoder().encode(datos.clave).length > 72) {
      nuevos.clave = 'La contraseña supera el tamaño permitido.'
    }

    if (datos.confirmarClave !== datos.clave) {
      nuevos.confirmarClave = 'Las contraseñas no coinciden.'
    }

    return nuevos
  }

  async function enviar(evento) {
    evento.preventDefault()

    if (enviando) return

    const nuevos = validar()
    setErrores(nuevos)

    if (Object.keys(nuevos).length > 0) return

    setEnviando(true)

    try {
      await onRegistrar({
        nombres: datos.nombres.trim(),
        apellidos: datos.apellidos.trim(),
        tipo_documento: 'CEDULA',
        pais_documento: 'EC',
        numero_documento: datos.numero_documento.trim(),
        telefono: datos.telefono.trim(),
        correo: datos.correo.trim().toLowerCase(),
        clave: datos.clave,
      })

      setDatos((actual) => ({
        ...actual,
        clave: '',
        confirmarClave: '',
      }))
    } catch (error) {
      setErrores({
        general: error instanceof Error
          ? error.message
          : 'No se pudo registrar la cuenta.',
      })
    } finally {
      setEnviando(false)
    }
  }

  const campos = [
    {
      name: 'nombres',
      etiqueta: 'Nombres',
      autoComplete: 'given-name',
      maxLength: 100,
    },
    {
      name: 'apellidos',
      etiqueta: 'Apellidos',
      autoComplete: 'family-name',
      maxLength: 100,
    },
    {
      name: 'numero_documento',
      etiqueta: 'Cédula',
      inputMode: 'numeric',
      maxLength: 10,
    },
    {
      name: 'telefono',
      etiqueta: 'Celular',
      type: 'tel',
      autoComplete: 'tel',
      maxLength: 10,
    },
    {
      name: 'correo',
      etiqueta: 'Correo electrónico',
      type: 'email',
      autoComplete: 'email',
      maxLength: 254,
    },
    {
      name: 'clave',
      etiqueta: 'Contraseña',
      type: mostrarClave ? 'text' : 'password',
      autoComplete: 'new-password',
    },
    {
      name: 'confirmarClave',
      etiqueta: 'Confirmar contraseña',
      type: mostrarClave ? 'text' : 'password',
      autoComplete: 'new-password',
    },
  ]

  return (
    <form
      onSubmit={enviar}
      className="auth-campos"
      noValidate
      aria-busy={enviando}
    >
      <h2>Crear cuenta</h2>

      <p className="muted">
        Completa tus datos. Te enviaremos un código para verificar tu correo.
      </p>

      {campos.map(({ name, etiqueta, ...atributos }) => (
        <label
          key={name}
          className={'campo' + (errores[name] ? ' mal' : '')}
          htmlFor={`registro-${name}`}
        >
          <span>{etiqueta}</span>

          <input
            {...atributos}
            id={`registro-${name}`}
            name={name}
            value={datos[name]}
            onChange={cambiar}
            disabled={enviando}
            aria-invalid={Boolean(errores[name])}
            aria-describedby={
              errores[name] ? `error-${name}` : undefined
            }
            required
          />

          {errores[name] && (
            <small id={`error-${name}`} role="alert">
              {errores[name]}
            </small>
          )}
        </label>
      ))}

      <button
        type="button"
        className="btn-link"
        onClick={() => setMostrarClave((actual) => !actual)}
        aria-pressed={mostrarClave}
      >
        {mostrarClave ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}
      </button>

      {errores.general && (
        <p className="auth-aviso" role="alert">
          {errores.general}
        </p>
      )}

      <button
        type="submit"
        className="btn btn-oscuro btn-lg ancho"
        disabled={enviando}
      >
        {enviando ? 'Registrando...' : 'Crear cuenta'}
      </button>

      <button
        type="button"
        className="btn-link"
        onClick={onVolver}
        disabled={enviando}
      >
        Ya tengo cuenta. Iniciar sesión
      </button>
    </form>
  )
}