
import { useCallback, useEffect, useState } from 'react'
import { oficinistasService } from './services/oficinistas.service'

export default function TabOficinistas() {
  const [oficinistas, setOficinistas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [procesando, setProcesando] = useState(null)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')

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
          <button
            type="button"
            className="btn btn-claro"
            onClick={cargar}
            disabled={cargando}
          >
            Actualizar
          </button>
        </div>

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
