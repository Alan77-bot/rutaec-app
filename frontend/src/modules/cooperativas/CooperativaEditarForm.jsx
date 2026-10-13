
import { useEffect, useState } from 'react'

export default function CooperativaEditarForm({ cooperativa, onCancelar }) {
  const [form, setForm] = useState({
    nombre_comercial: '',
    razon_social: '',
  })

  useEffect(() => {
    if (cooperativa) {
      setForm({
        nombre_comercial: cooperativa.nombre_comercial,
        razon_social: cooperativa.razon_social,
      })
    }
  }, [cooperativa])

  if (!cooperativa) return null

  function cambiar(campo, valor) {
    setForm((actual) => ({
      ...actual,
      [campo]: valor,
    }))
  }

  return (
    <div className="panel">
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

      <div className="form-fila">
        <button
          type="button"
          className="btn btn-oscuro"
          disabled
        >
          Guardar cambios
        </button>

        <button
          type="button"
          className="btn btn-claro"
          onClick={onCancelar}
        >
          Cancelar
        </button>
      </div>

      <p className="muted">
        La edición estará disponible cuando se integren
        los permisos de administrador.
      </p>
    </div>
  )
}
