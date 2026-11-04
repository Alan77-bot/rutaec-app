
import { useState } from 'react'
import { registrarCooperativa } from './services/cooperativas.service'

const FORMULARIO_INICIAL = {
  ruc: '',
  razon_social: '',
  nombre_comercial: '',
  correo: '',
  telefono: '',
  direccion: '',
}

export default function CooperativaRegistroForm({ onRegistrada }) {
  const [form, setForm] = useState(FORMULARIO_INICIAL)

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true)
    setError('')
    setMensaje('')

    try {
      await registrarCooperativa(form)

      setMensaje('Cooperativa registrada correctamente')
      setForm({ ...FORMULARIO_INICIAL })

      try {
        await onRegistrada?.()
      } catch {
        setError('La cooperativa se registró, pero no se pudo actualizar el listado.')
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error al registrar la cooperativa'
      )
    } finally {
      setGuardando(false)
    }
  }

  function cambiar(campo, valor) {
    setForm((actual) => ({
      ...actual,
      [campo]: valor,
    }))
  }

  return (
    <form className="panel" onSubmit={guardar}>
      <h4>Nueva cooperativa</h4>

      <label>
        RUC
        <input
          value={form.ruc}
          maxLength={13}
          inputMode="numeric"
          pattern="[0-9]{13}"
          required
          placeholder="13 dígitos"
          onChange={(e) => cambiar('ruc', e.target.value.replace(/\D/g, ''))}
        />
      </label>

      <label>
        Razón social
        <input
          value={form.razon_social}
          required
          onChange={(e) => cambiar('razon_social', e.target.value)}
        />
      </label>

      <label>
        Nombre comercial
        <input
          value={form.nombre_comercial}
          required
          onChange={(e) => cambiar('nombre_comercial', e.target.value)}
        />
      </label>

      <label>
        Correo electrónico
        <input
          type="email"
          value={form.correo}
          required
          onChange={(e) => cambiar('correo', e.target.value)}
        />
      </label>

      <label>
        Teléfono
        <input
          type="tel"
          value={form.telefono}
          required
          onChange={(e) => cambiar('telefono', e.target.value)}
        />
      </label>

      <label>
        Dirección
        <input
          value={form.direccion}
          required
          onChange={(e) => cambiar('direccion', e.target.value)}
        />
      </label>

      <button
        type="submit"
        className="btn btn-oscuro"
        disabled={guardando}
      >
        {guardando ? 'Registrando...' : 'Registrar cooperativa'}
      </button>

      {error && <p role="alert" className="muted">{error}</p>}
      {mensaje && <p role="status">{mensaje}</p>}
    </form>
  )
}
