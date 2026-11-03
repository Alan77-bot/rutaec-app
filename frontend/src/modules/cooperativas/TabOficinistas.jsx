
import { useCallback, useEffect, useState } from 'react'
import { oficinistasService } from './services/oficinistas.service'

export default function TabOficinistas() {
  const [oficinistas, setOficinistas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [procesando, setProcesando] = useState(null)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')

  const [mostrarAsignacion, setMostrarAsignacion] = useState(false)
  const [usuariosDisponibles, setUsuariosDisponibles] = useState([])
  const [cargandoUsuarios, setCargandoUsuarios] = useState(false)
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState('')
  const [asignando, setAsignando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')

    try {
      const datos = await oficinistasService.listar()
      setOficinistas(datos)
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los oficinistas.')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  const abrirAsignacion = async () => {
    setMostrarAsignacion(true)
    setCargandoUsuarios(true)
    setUsuariosDisponibles([])
    setUsuarioSeleccionado('')
    setError('')
    setMensaje('')

    try {
      const usuarios = await oficinistasService.listarUsuariosDisponibles()
      setUsuariosDisponibles(usuarios)
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los usuarios disponibles.')
    } finally {
      setCargandoUsuarios(false)
    }
  }

  const asignarUsuario = async (evento) => {
    evento.preventDefault()

    if (!usuarioSeleccionado || asignando) return

    setAsignando(true)
    setError('')
    setMensaje('')

    try {
      await oficinistasService.asignar(usuarioSeleccionado)
      await cargar()

      setMostrarAsignacion(false)
      setUsuariosDisponibles([])
      setUsuarioSeleccionado('')
      setMensaje('Oficinista asignado correctamente.')
    } catch (err) {
      setError(err.message || 'No se pudo asignar el oficinista.')
    } finally {
      setAsignando(false)
    }
  }

  const cambiarEstado = async (oficinista) => {
    const activar = !oficinista.activo

    setProcesando(oficinista.usuario_id)
    setError('')
    setMensaje('')

    try {
      await oficinistasService.cambiarEstado(
        oficinista.usuario_id,
        activar
      )

      await cargar()

      setMensaje(
        activar
          ? 'Oficinista activado correctamente.'
          : 'Oficinista desactivado correctamente.'
      )
    } catch (err) {
      setError(err.message || 'No se pudo cambiar el estado.')
    } finally {
      setProcesando(null)
    }
  }

  return (
    <section>
      <div className="seccion-cab izq">
        <h2>Gestión de oficinistas</h2>
        <p>Administra el acceso del personal de tu cooperativa.</p>
      </div>

      {error && (
        <div className="aviso-hoja mal" role="alert">
          {error}
        </div>
      )}

      {mensaje && (
        <div className="panel" role="status">
          {mensaje}
        </div>
      )}

      <div className="panel">
        <div className="form-fila">
          <h4>Personal registrado</h4>

          <div className="form-fila">
            <button
              type="button"
              className="btn btn-oscuro"
              disabled={asignando}
              onClick={() => {
                if (mostrarAsignacion) {
                  setMostrarAsignacion(false)
                  setUsuarioSeleccionado('')
                } else {
                  abrirAsignacion()
                }
              }}
            >
              {mostrarAsignacion ? 'Cancelar asignación' : 'Asignar oficinista'}
            </button>

            <button
              type="button"
              className="btn btn-claro"
              onClick={cargar}
              disabled={cargando}
            >
              Actualizar
            </button>
          </div>
        </div>

        {mostrarAsignacion && (
          <div className="panel">
            <h4>Asignar usuario existente</h4>

            {cargandoUsuarios ? (
              <p className="muted">Cargando usuarios disponibles...</p>
            ) : usuariosDisponibles.length === 0 ? (
              <p className="muted">
                No hay usuarios disponibles para asignar.
              </p>
            ) : (
              <form onSubmit={asignarUsuario}>
                <div className="form-fila">
                  <label htmlFor="usuario-oficinista">
                    Usuario disponible
                  </label>

                  <select
                    id="usuario-oficinista"
                    value={usuarioSeleccionado}
                    onChange={(evento) =>
                      setUsuarioSeleccionado(evento.target.value)
                    }
                    required
                    disabled={asignando}
                  >
                    <option value="">Selecciona un usuario</option>

                    {usuariosDisponibles.map((usuario) => (
                      <option key={usuario.id} value={usuario.id}>
                        {usuario.nombres} {usuario.apellidos} — {usuario.correo}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  className="btn btn-oscuro"
                  disabled={!usuarioSeleccionado || asignando}
                >
                  {asignando ? 'Asignando...' : 'Confirmar asignación'}
                </button>
              </form>
            )}
          </div>
        )}

        {cargando ? (
          <p className="muted">Cargando oficinistas...</p>
        ) : oficinistas.length === 0 ? (
          <div className="vacio">
            <b>Aún no tienes oficinistas registrados.</b>
          </div>
        ) : (
          <div className="tabla-wrap">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Oficinista</th>
                  <th>Correo</th>
                  <th>Teléfono</th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>

              <tbody>
                {oficinistas.map((oficinista) => (
                  <tr
                    key={oficinista.usuario_id}
                    className={oficinista.activo ? '' : 'inactiva'}
                  >
                    <td>
                      <b>
                        {oficinista.usuarios.nombres}{' '}
                        {oficinista.usuarios.apellidos}
                      </b>
                    </td>

                    <td>{oficinista.usuarios.correo}</td>
                    <td>{oficinista.usuarios.telefono}</td>

                    <td>
                      <span
                        className={
                          'badge ' +
                          (oficinista.activo ? 'verde' : 'gris')
                        }
                      >
                        {oficinista.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>

                    <td>
                      <button
                        type="button"
                        className={
                          'btn ' +
                          (oficinista.activo
                            ? 'btn-claro'
                            : 'btn-oscuro')
                        }
                        disabled={
                          procesando === oficinista.usuario_id ||
                          !oficinista.usuarios.activo ||
                          !oficinista.usuarios.correo_verificado_en
                        }
                        onClick={() => cambiarEstado(oficinista)}
                      >
                        {procesando === oficinista.usuario_id
                          ? 'Guardando...'
                          : oficinista.activo
                            ? 'Desactivar'
                            : 'Activar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
