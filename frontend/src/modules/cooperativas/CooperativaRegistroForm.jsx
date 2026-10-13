
import { useState } from 'react'

const FORMULARIO_INICIAL = {
  ruc: '',
  razon_social: '',
  nombre_comercial: '',
  correo: '',
  telefono: '',
  direccion: '',
}

export default function CooperativaRegistroForm() {
  const [form, setForm] = useState(FORMULARIO_INICIAL)

  function cambiar(campo, valor) {
    setForm((actual) => ({
      ...actual,
      [campo]: valor,
    }))
  }

  return (
    <form className="panel">
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
        type="button"
        className="btn btn-oscuro"
        disabled
      >
        Registrar cooperativa
      </button>

      <p className="muted">
        El registro estará disponible cuando se integren
        los permisos de administrador.
      </p>
    </form>
  )
}
