
import { useCallback, useEffect, useState } from 'react'
import { oficinistasService } from './services/oficinistas.service'

const LIMITE = 10

const FORMULARIO_VACIO = {
  nombres: '',
  apellidos: '',
  correo: '',
  numero_documento: '',
  telefono: '',
  clave: '',
}

const PAGINACION_INICIAL = {
  pagina: 1,
  limite: LIMITE,
  total: 0,
  totalPaginas: 0,
}

function obtenerMensajeError(error, predeterminado) {
  return error instanceof Error ? error.message : predeterminado
}

export default function TabOficinistas() {
  const [oficinistas, setOficinistas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [procesando, setProcesando] = useState(null)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')

  // Asignación de usuarios existentes
  const [mostrarAsignacion, setMostrarAsignacion] = useState(false)
  const [usuariosDisponibles, setUsuariosDisponibles] = useState([])
  const [cargandoUsuarios, setCargandoUsuarios] = useState(false)
  const [errorUsuarios, setErrorUsuarios] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)
  const [paginacion, setPaginacion] = useState(PAGINACION_INICIAL)
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState('')
  const [asignando, setAsignando] = useState(false)

  // Registro de nuevos oficinistas
  const [mostrarCreacion, setMostrarCreacion] = useState(false)
  const [creando, setCreando] = useState(false)
  const [nuevoOficinista, setNuevoOficinista] = useState({
    ...FORMULARIO_VACIO,
  })

  const hayOperacion = asignando || creando || procesando !== null

  // Cargar personal registrado
  const cargar = useCallback(async () => {
    setCargando(true)

    try {
      const datos = await oficinistasService.listar()
      setOficinistas(datos)
      return true
    } catch (err) {
      setError(
        obtenerMensajeError(
          err,
          'No se pudieron cargar los oficinistas.'
        )
      )
      return false
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  // Consultar usuarios disponibles con búsqueda y paginación
  useEffect(() => {
    if (!mostrarAsignacion) return

    let cancelado = false

    setCargandoUsuarios(true)
    setErrorUsuarios('')

    const consultar = async () => {
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
        setPaginacion(PAGINACION_INICIAL)
        setErrorUsuarios(
          obtenerMensajeError(
            err,
            'No se pudieron cargar los usuarios disponibles.'
          )
        )
      } finally {
        if (!cancelado) {
          setCargandoUsuarios(false)
        }
      }
    }

    const temporizador = setTimeout(consultar, 300)

    return () => {
      cancelado = true
      clearTimeout(temporizador)
    }
  }, [mostrarAsignacion, busqueda, pagina])

  // Abrir asignación
  const abrirAsignacion = () => {
    setMostrarCreacion(false)
    setNuevoOficinista({ ...FORMULARIO_VACIO })

    setBusqueda('')
    setPagina(1)
    setUsuarioSeleccionado('')
    setUsuariosDisponibles([])
    setPaginacion(PAGINACION_INICIAL)
    setErrorUsuarios('')
    setError('')
    setMensaje('')
    setMostrarAsignacion(true)
  }

  const cerrarAsignacion = () => {
    setMostrarAsignacion(false)
    setUsuarioSeleccionado('')
    setErrorUsuarios('')
  }

  // Asignar usuario existente
  const asignarUsuario = async () => {
    if (!usuarioSeleccionado || hayOperacion) return

    setAsignando(true)
    setError('')
    setMensaje('')

    try {
      await oficinistasService.asignar(usuarioSeleccionado)

      cerrarAsignacion()

      setMensaje('Oficinista asignado correctamente.')
      await cargar()
    } catch (err) {
      setError(
        obtenerMensajeError(
          err,
          'No se pudo asignar el oficinista.'
        )
      )
    } finally {
      setAsignando(false)
    }
  }

  // Activar o desactivar oficinista
  const cambiarEstado = async (oficinista) => {
    if (hayOperacion) return

    const activar = !oficinista.activo

    setProcesando(oficinista.usuario_id)
    setError('')
    setMensaje('')

    try {
      await oficinistasService.cambiarEstado(
        oficinista.usuario_id,
        activar
      )

      setMensaje(
        activar
          ? 'Oficinista activado correctamente.'
          : 'Oficinista desactivado correctamente.'
      )

      await cargar()
    } catch (err) {
      setError(
        obtenerMensajeError(
          err,
          'No se pudo cambiar el estado.'
        )
      )
    } finally {
      setProcesando(null)
    }
  }

  // Abrir formulario de creación
  const abrirCreacion = () => {
    cerrarAsignacion()
    setNuevoOficinista({ ...FORMULARIO_VACIO })
    setError('')
    setMensaje('')
    setMostrarCreacion(true)
  }

  // Cerrar formulario de creación
  const cerrarCreacion = () => {
    setMostrarCreacion(false)
    setNuevoOficinista({ ...FORMULARIO_VACIO })
  }

  // Actualizar campos del formulario
  const actualizarNuevoOficinista = (evento) => {
    const { name, value } = evento.target

    setNuevoOficinista((actual) => ({
      ...actual,
      [name]: value,
    }))
  }

  // Registrar nuevo oficinista
  const registrarOficinista = async (evento) => {
    evento.preventDefault()

    if (hayOperacion) return

    setCreando(true)
    setError('')
    setMensaje('')

    try {
      await oficinistasService.registrarNuevo(nuevoOficinista)

      cerrarCreacion()

      setMensaje(
        'Oficinista registrado correctamente. Debe verificar su correo electrónico antes de utilizar su cuenta.'
      )

      await cargar()
    } catch (err) {
      setError(
        obtenerMensajeError(
          err,
          'No se pudo registrar el oficinista.'
        )
      )
    } finally {
      setCreando(false)
    }
  }

  const seleccionado = usuariosDisponibles.find(
    (usuario) => usuario.id === usuarioSeleccionado
  )

  return (
    <section>
      <div className="seccion-cab izq">
        <h2>Gestión de oficinistas</h2>
        <p>
          Administra el acceso del personal de tu cooperativa.
        </p>
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
        {/* Cabecera y botones */}
        <div className="form-fila">
          <h4>Personal registrado</h4>

          <div className="form-fila">
            <button
              type="button"
              className="btn btn-oscuro"
              disabled={hayOperacion}
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
              className="btn btn-oscuro"
              disabled={hayOperacion}
              onClick={
                mostrarCreacion
                  ? cerrarCreacion
                  : abrirCreacion
              }
            >
              {mostrarCreacion
                ? 'Cancelar creación'
                : 'Crear nuevo oficinista'}
            </button>

            <button
              type="button"
              className="btn btn-claro"
              disabled={cargando || hayOperacion}
              onClick={() => {
                setError('')
                setMensaje('')
                cargar()
              }}
            >
              Actualizar
            </button>
          </div>
        </div>

        {/* Formulario para crear nuevo oficinista */}
        {mostrarCreacion && (
          <div className="panel">
            <h4>Crear nuevo oficinista</h4>

            <p className="muted">
              Registra un usuario nuevo y asígnalo a tu
              cooperativa. Deberá verificar su correo
              electrónico antes de utilizar su cuenta.
            </p>

            <form onSubmit={registrarOficinista}>
              <div className="form-fila">
                <label htmlFor="oficinista-nombres">
                  Nombres
                </label>
                <input
                  id="oficinista-nombres"
                  name="nombres"
                  type="text"
                  maxLength={100}
                  required
                  autoComplete="given-name"
                  value={nuevoOficinista.nombres}
                  onChange={actualizarNuevoOficinista}
                  disabled={creando}
                />
              </div>

              <div className="form-fila">
                <label htmlFor="oficinista-apellidos">
                  Apellidos
                </label>
                <input
                  id="oficinista-apellidos"
                  name="apellidos"
                  type="text"
                  maxLength={100}
                  required
                  autoComplete="family-name"
                  value={nuevoOficinista.apellidos}
                  onChange={actualizarNuevoOficinista}
                  disabled={creando}
                />
              </div>

              <div className="form-fila">
                <label htmlFor="oficinista-correo">
                  Correo electrónico
                </label>
                <input
                  id="oficinista-correo"
                  name="correo"
                  type="email"
                  maxLength={254}
                  required
                  autoComplete="email"
                  value={nuevoOficinista.correo}
                  onChange={actualizarNuevoOficinista}
                  disabled={creando}
                />
              </div>

              <div className="form-fila">
                <label htmlFor="oficinista-documento">
                  Cédula
                </label>
                <input
                  id="oficinista-documento"
                  name="numero_documento"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{10}"
                  maxLength={10}
                  required
                  value={nuevoOficinista.numero_documento}
                  onChange={actualizarNuevoOficinista}
                  disabled={creando}
                />
              </div>

              <div className="form-fila">
                <label htmlFor="oficinista-telefono">
                  Celular
                </label>
                <input
                  id="oficinista-telefono"
                  name="telefono"
                  type="tel"
                  inputMode="numeric"
                  pattern="09[0-9]{8}"
                  maxLength={10}
                  required
                  autoComplete="tel"
                  value={nuevoOficinista.telefono}
                  onChange={actualizarNuevoOficinista}
                  disabled={creando}
                />
              </div>

              <div className="form-fila">
                <label htmlFor="oficinista-clave">
                  Contraseña
                </label>
                <input
                  id="oficinista-clave"
                  name="clave"
                  type="password"
                  minLength={12}
                  required
                  autoComplete="new-password"
                  value={nuevoOficinista.clave}
                  onChange={actualizarNuevoOficinista}
                  disabled={creando}
                />
              </div>

              <p className="muted">
                La contraseña debe contener al menos
                12 caracteres. El correo se verificará
                mediante el proceso habitual.
              </p>

              <div className="form-fila">
                <button
                  type="submit"
                  className="btn btn-oscuro"
                  disabled={creando}
                >
                  {creando
                    ? 'Registrando...'
                    : 'Registrar oficinista'}
                </button>

                <button
                  type="button"
                  className="btn btn-claro"
                  onClick={cerrarCreacion}
                  disabled={creando}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tabla para asignar usuarios existentes */}
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
                maxLength={100}
                placeholder="Nombre, apellido, correo o documento"
                value={busqueda}
                disabled={asignando}
                onChange={(evento) => {
                  setBusqueda(evento.target.value)
                  setPagina(1)
                  setUsuarioSeleccionado('')
                  setUsuariosDisponibles([])
                  setPaginacion(PAGINACION_INICIAL)
                  setCargandoUsuarios(true)
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
            ) : !errorUsuarios &&
              usuariosDisponibles.length === 0 ? (
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
                              {usuario.nombres}{' '}
                              {usuario.apellidos}
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
                    disabled={pagina <= 1 || hayOperacion}
                    onClick={() => {
                      setPagina((actual) => actual - 1)
                      setUsuarioSeleccionado('')
                      setUsuariosDisponibles([])
                      setCargandoUsuarios(true)
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
                      hayOperacion
                    }
                    onClick={() => {
                      setPagina((actual) => actual + 1)
                      setUsuarioSeleccionado('')
                      setUsuariosDisponibles([])
                      setCargandoUsuarios(true)
                    }}
                  >
                    Siguiente
                  </button>
                </div>
              </>
            ) : null}

            {seleccionado && !cargandoUsuarios && (
              <div className="panel">
                <p>
                  Vas a asignar a{' '}
                  <b>
                    {seleccionado.nombres}{' '}
                    {seleccionado.apellidos}
                  </b>{' '}
                  como oficinista de tu cooperativa.
                </p>

                <button
                  type="button"
                  className="btn btn-oscuro"
                  disabled={hayOperacion}
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

        {/* Listado de oficinistas registrados */}
        {cargando ? (
          <p className="muted">
            Cargando oficinistas...
          </p>
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
                    className={
                      oficinista.activo ? '' : 'inactiva'
                    }
                  >
                    <td>
                      <b>
                        {oficinista.usuarios.nombres}{' '}
                        {oficinista.usuarios.apellidos}
                      </b>
                    </td>

                    <td>
                      {oficinista.usuarios.correo}
                    </td>

                    <td>
                      {oficinista.usuarios.telefono}
                    </td>

                    <td>
                      <span
                        className={
                          'badge ' +
                          (oficinista.activo
                            ? 'verde'
                            : 'gris')
                        }
                      >
                        {oficinista.activo
                          ? 'Activo'
                          : 'Inactivo'}
                      </span>

                      {!oficinista.usuarios.correo_verificado_en && (
                        <span className="muted">
                          {' '}· Correo pendiente
                        </span>
                      )}
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
                          hayOperacion ||
                          !oficinista.usuarios.activo ||
                          !oficinista.usuarios.correo_verificado_en
                        }
                        onClick={() =>
                          cambiarEstado(oficinista)
                        }
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
