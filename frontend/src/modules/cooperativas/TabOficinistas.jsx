
import { useCallback, useEffect, useState } from 'react'
import { oficinistasService } from './services/oficinistas.service'

const LIMITE = 10

export default function TabOficinistas() {
  const [oficinistas, setOficinistas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [procesando, setProcesando] = useState(null)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')

  const [mostrarAsignacion, setMostrarAsignacion] = useState(false)
  const [usuariosDisponibles, setUsuariosDisponibles] = useState([])
  const [cargandoUsuarios, setCargandoUsuarios] = useState(false)
  const [errorUsuarios, setErrorUsuarios] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)
  const [paginacion, setPaginacion] = useState({
    pagina: 1,
    limite: LIMITE,
    total: 0,
    totalPaginas: 0,
  })
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

  useEffect(() => {
    if (!mostrarAsignacion) return

    let cancelado = false

    const consultar = async () => {
      setCargandoUsuarios(true)
      setErrorUsuarios('')

      try {
        const resultado =
          await oficinistasService.listarUsuariosDisponibles(
            busqueda,
            pagina,
            LIMITE
          )

        if (cancelado) return

        setUsuariosDisponibles(resultado.datos)
        setPaginacion(resultado.paginacion)
      } catch (err) {
        if (cancelado) return

        setUsuariosDisponibles([])
        setErrorUsuarios(
          err.message || 'No se pudieron cargar los usuarios disponibles.'
        )
      } finally {
        if (!cancelado) setCargandoUsuarios(false)
      }
    }

    const temporizador = setTimeout(consultar, 300)

    return () => {
      cancelado = true
      clearTimeout(temporizador)
    }
  }, [mostrarAsignacion, busqueda, pagina])

  const abrirAsignacion = () => {
    setBusqueda('')
    setPagina(1)
    setUsuarioSeleccionado('')
    setUsuariosDisponibles([])
    setErrorUsuarios('')
    setMensaje('')
    setMostrarAsignacion(true)
  }

  const cerrarAsignacion = () => {
    setMostrarAsignacion(false)
    setUsuarioSeleccionado('')
    setErrorUsuarios('')
  }

  const asignarUsuario = async () => {
    if (!usuarioSeleccionado || asignando) return

    setAsignando(true)
    setError('')
    setMensaje('')

    try {
      await oficinistasService.asignar(usuarioSeleccionado)
      await cargar()

      cerrarAsignacion()
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

  const seleccionado = usuariosDisponibles.find(
    (usuario) => usuario.id === usuarioSeleccionado
  )

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
              onClick={
                mostrarAsignacion
                  ? cerrarAsignacion
                  : abrirAsignacion
              }
            >
              {mostrarAsignacion
                ? 'Cancelar asignación'
                : 'Asignar oficinista'}
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
            <h4>Usuarios disponibles</h4>

            <div className="form-fila">
              <label htmlFor="buscar-oficinista">
                Buscar usuario
              </label>

              <input
                id="buscar-oficinista"
                type="search"
                placeholder="Nombre, apellido, correo o documento"
                value={busqueda}
                disabled={asignando}
                onChange={(evento) => {
                  setBusqueda(evento.target.value)
                  setPagina(1)
                  setUsuarioSeleccionado('')
                }}
              />
            </div>

            {errorUsuarios && (
              <div className="aviso-hoja mal" role="alert">
                {errorUsuarios}
              </div>
            )}

            {cargandoUsuarios ? (
              <p className="muted">Buscando usuarios...</p>
            ) : !errorUsuarios && usuariosDisponibles.length === 0 ? (
              <div className="vacio">
                No se encontraron usuarios disponibles.
              </div>
            ) : !errorUsuarios ? (
              <>
                <div className="tabla-wrap">
                  <table className="tabla">
                    <thead>
                      <tr>
                        <th>Usuario</th>
                        <th>Correo</th>
                        <th>Documento</th>
                        <th>Acción</th>
                      </tr>
                    </thead>

                    <tbody>
                      {usuariosDisponibles.map((usuario) => (
                        <tr key={usuario.id}>
                          <td>
                            <b>
                              {usuario.nombres} {usuario.apellidos}
                            </b>
                          </td>
                          <td>{usuario.correo}</td>
                          <td>{usuario.numero_documento}</td>
                          <td>
                            <button
                              type="button"
                              className={
                                'btn ' +
                                (usuarioSeleccionado === usuario.id
                                  ? 'btn-oscuro'
                                  : 'btn-claro')
                              }
                              disabled={asignando}
                              onClick={() =>
                                setUsuarioSeleccionado(usuario.id)
                              }
                            >
                              {usuarioSeleccionado === usuario.id
                                ? 'Seleccionado'
                                : 'Seleccionar'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="form-fila">
                  <button
                    type="button"
                    className="btn btn-claro"
                    disabled={pagina <= 1 || cargandoUsuarios || asignando}
                    onClick={() => {
                      setPagina((actual) => actual - 1)
                      setUsuarioSeleccionado('')
                    }}
                  >
                    Anterior
                  </button>

                  <span className="muted">
                    Página {paginacion.pagina} de{' '}
                    {paginacion.totalPaginas || 1}
                    {' · '}
                    {paginacion.total} usuarios
                  </span>

                  <button
                    type="button"
                    className="btn btn-claro"
                    disabled={
                      pagina >= paginacion.totalPaginas ||
                      cargandoUsuarios ||
                      asignando
                    }
                    onClick={() => {
                      setPagina((actual) => actual + 1)
                      setUsuarioSeleccionado('')
                    }}
                  >
                    Siguiente
                  </button>
                </div>
              </>
            ) : null}

            {seleccionado && (
              <div className="panel">
                <p>
                  Vas a asignar a{' '}
                  <b>
                    {seleccionado.nombres} {seleccionado.apellidos}
                  </b>{' '}
                  como oficinista de tu cooperativa.
                </p>

                <button
                  type="button"
                  className="btn btn-oscuro"
                  disabled={asignando}
                  onClick={asignarUsuario}
                >
                  {asignando
                    ? 'Asignando...'
                    : 'Confirmar asignación'}
                </button>
              </div>
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
