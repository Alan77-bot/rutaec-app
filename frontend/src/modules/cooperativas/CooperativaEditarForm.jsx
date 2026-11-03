
import { useEffect, useState } from 'react'
import { actualizarCooperativa } from './services/cooperativas.service'

export default function CooperativaEditarForm({ cooperativa, onCancelar, onActualizada }) {
  const [form, setForm] = useState({
  nombre_comercial: '',
  razon_social: '',
  correo: '',
  telefono: '',
  direccion: '',
  sitio_web: '',
})
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (cooperativa) {
      setForm({
        nombre_comercial: cooperativa.nombre_comercial,
        razon_social: cooperativa.razon_social,
        correo: cooperativa.correo ?? '',
        telefono: cooperativa.telefono ?? '',
        direccion: cooperativa.direccion ?? '',
        sitio_web: cooperativa.sitio_web ?? '',
      })
    }
  }, [cooperativa])

  async function guardar(e) {
  e.preventDefault()
  setGuardando(true)
  setError('')

  try {
    await actualizarCooperativa(cooperativa.id, form)
    await onActualizada?.()
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : 'No se pudo actualizar la cooperativa'
    )
  } finally {
    setGuardando(false)
  }
}

  if (!cooperativa) return null

  function cambiar(campo, valor) {
    setForm((actual) => ({
      ...actual,
      [campo]: valor,
    }))
  }

  return (
    <form className="panel" onSubmit={guardar}>
      <h4>Editar cooperativa</h4>

      <p className="muted">
        Modificando: {cooperativa.nombre_comercial}
      </p>

      <label>
        Nombre comercial
        <input
          value={form.nombre_comercial}
          required
          onChange={(e) => cambiar('nombre_comercial', e.target.value)}
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

<label>
  Sitio web (opcional)
  <input
    type="url"
    value={form.sitio_web}
    placeholder="https://ejemplo.com"
    onChange={(e) => cambiar('sitio_web', e.target.value)}
  />
</label>

      <div className="form-fila">
        <button
          type="submit"
          className="btn btn-oscuro"
          disabled={guardando}
        >
         {guardando ? 'Guardando...' : 'Guardar cambios'}
        </button>

        <button
          type="button"
          className="btn btn-claro"
          onClick={onCancelar}
        >
          Cancelar
        </button>
      </div>

      {error && <p role="alert" className="muted">{error}</p>}
    </form>
  )
}
