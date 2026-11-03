
import { useCallback, useEffect, useRef, useState } from 'react'
import { oficinistasService } from './services/oficinistas.service'
import './TabOficinistas.css'

const LIMITE = 10

const FORMULARIO_VACIO = {
  nombres: '',
  apellidos: '',
  correo: '',
  numero_documento: '',
  telefono: '',
  clave: '',
}

function mensajeError(error, predeterminado) {
  return error instanceof Error ? error.message : predeterminado
}

function Modal({
  titulo,
  descripcion,
  children,
  onCerrar,
  bloqueado = false,
  ancho = 'normal',
}) {
  const dialogoRef = useRef(null)
  const cerrarRef = useRef(onCerrar)
  const bloqueadoRef = useRef(bloqueado)

  useEffect(() => {
    cerrarRef.current = onCerrar
    bloqueadoRef.current = bloqueado
  }, [onCerrar, bloqueado])

  useEffect(() => {
    const anterior = document.activeElement
    const dialogo = dialogoRef.current

    if (!dialogo) return

    const enfocarPrimero = () => {
      const primero = dialogo.querySelector(
        'input:not(:disabled), button:not(:disabled), select:not(:disabled)'
      )

      if (primero) {
        primero.focus()
      } else {
        dialogo.focus()
      }
    }

    enfocarPrimero()

    const manejarTeclado = (evento) => {
      if (evento.key === 'Escape') {
        evento.preventDefault()

        if (!bloqueadoRef.current) {
          cerrarRef.current()
        }

        return
      }

      if (evento.key !== 'Tab') return

      const elementos = Array.from(
        dialogo.querySelectorAll(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
        )
      )

      if (elementos.length === 0) {
        evento.preventDefault()
        dialogo.focus()
        return
      }

      const primero = elementos[0]
      const ultimo = elementos[elementos.length - 1]
      const actual = document.activeElement

      if (!dialogo.contains(actual)) {
        evento.preventDefault()
        primero.focus()
      } else if (evento.shiftKey && actual === primero) {
        evento.preventDefault()
        ultimo.focus()
      } else if (!evento.shiftKey && actual === ultimo) {
        evento.preventDefault()
        primero.focus()
      }
    }

    document.addEventListener('keydown', manejarTeclado)

    return () => {
      document.removeEventListener('keydown', manejarTeclado)

      if (anterior instanceof HTMLElement) {
        anterior.focus()
      }
    }
  }, [])

  return (
    <div
      className="of-modal-fondo"
      onMouseDown={(evento) => {
        if (
          evento.target === evento.currentTarget &&
          !bloqueado
        ) {
          onCerrar()
        }
      }}
    >
      <div
        ref={dialogoRef}
        className={`of-modal of-modal--${ancho}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-oficinistas-titulo"
        aria-describedby={
          descripcion
            ? 'modal-oficinistas-descripcion'
            : undefined
        }
        tabIndex={-1}
      >
        <div className="of-modal-cabecera">
          <div>
            <h3 id="modal-oficinistas-titulo">{titulo}</h3>

            {descripcion && (
              <p
                id="modal-oficinistas-descripcion"
                className="muted"
              >
                {descripcion}
              </p>
            )}
          </div>

          <button
            type="button"
            className="of-modal-cerrar"
            onClick={onCerrar}
            disabled={bloqueado}
            aria-label="Cerrar ventana"
          >
            ×
          </button>
        </div>

        <div className="of-modal-contenido">
          {children}
        </div>
      </div>
    </div>
  )
}

export default function TabOficinistas() {
  const [oficinistas, setOficinistas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')

  const [filtroBusqueda, setFiltroBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')

  const [modal, setModal] = useState(null)
  const [procesando, setProcesando] = useState(false)
  const [errorModal, setErrorModal] = useState('')

  const [nuevoOficinista, setNuevoOficinista] = useState({
    ...FORMULARIO_VACIO,
  })

  const [usuariosDisponibles, setUsuariosDisponibles] = useState([])
  const [cargandoUsuarios, setCargandoUsuarios] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)

  const [paginacion, setPaginacion] = useState({
    pagina: 1,
    limite: LIMITE,
    total: 0,
    totalPaginas: 0,
  })

  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null)
  const [oficinistaEstado, setOficinistaEstado] = useState(null)

  // LISTAR OFICINISTAS

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')

    try {
      const datos = await oficinistasService.listar()
      setOficinistas(datos)
    } catch (err) {
      setError(
        mensajeError(
          err,
          'No se pudieron cargar los oficinistas.'
        )
      )
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  // CONSULTAR USUARIOS DISPONIBLES PARA ASIGNAR

  useEffect(() => {
    if (modal !== 'asignar') return

    let cancelado = false

    setCargandoUsuarios(true)
    setErrorModal('')

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
        setErrorModal(
          mensajeError(
            err,
            'No se pudieron consultar los usuarios disponibles.'
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
  }, [modal, busqueda, pagina])

  // FILTROS DEL LISTADO PRINCIPAL

  const oficinistasFiltrados = oficinistas.filter((oficinista) => {
    const usuario = oficinista.usuarios

    const texto = [
      usuario?.nombres ?? '',
      usuario?.apellidos ?? '',
      usuario?.correo ?? '',
    ]
      .join(' ')
      .toLocaleLowerCase('es')

    const busquedaNormalizada = filtroBusqueda
      .trim()
      .toLocaleLowerCase('es')

    const coincideBusqueda = texto.includes(busquedaNormalizada)

    const coincideEstado =
      filtroEstado === 'todos' ||
      (filtroEstado === 'activos' && oficinista.activo) ||
      (filtroEstado === 'inactivos' && !oficinista.activo)

    return coincideBusqueda && coincideEstado
  })

  const limpiarFiltros = () => {
    setFiltroBusqueda('')
    setFiltroEstado('todos')
  }

  // CONTROL DE MODALES

  const limpiarModal = useCallback(() => {
    setModal(null)
    setErrorModal('')
    setOficinistaEstado(null)
    setUsuarioSeleccionado(null)
    setNuevoOficinista({ ...FORMULARIO_VACIO })
  }, [])

  const cerrarModal = useCallback(() => {
    if (procesando) return
    limpiarModal()
  }, [procesando, limpiarModal])

  const abrirCrear = () => {
    setMensaje('')
    setErrorModal('')
    setNuevoOficinista({ ...FORMULARIO_VACIO })
    setModal('crear')
  }

  const abrirAsignar = () => {
    setMensaje('')
    setErrorModal('')
    setBusqueda('')
    setPagina(1)
    setUsuarioSeleccionado(null)
    setUsuariosDisponibles([])
    setModal('asignar')
  }

  const abrirEstado = (oficinista) => {
    setMensaje('')
    setErrorModal('')
    setOficinistaEstado(oficinista)
    setModal('estado')
  }

  const actualizarCampo = (evento) => {
    const { name, value } = evento.target

    setNuevoOficinista((actual) => ({
      ...actual,
      [name]: value,
    }))
  }

  // REGISTRAR NUEVO OFICINISTA

  const registrarNuevo = async (evento) => {
    evento.preventDefault()

    if (procesando) return

    setProcesando(true)
    setErrorModal('')

    try {
      await oficinistasService.registrarNuevo(nuevoOficinista)

      limpiarModal()

      setMensaje(
        'Oficinista registrado correctamente. La verificación de correo queda pendiente.'
      )

      await cargar()
    } catch (err) {
      setErrorModal(
        mensajeError(
          err,
          'No se pudo registrar el oficinista.'
        )
      )
    } finally {
      setProcesando(false)
    }
  }

  // ASIGNAR USUARIO EXISTENTE

  const asignarExistente = async () => {
    if (!usuarioSeleccionado || procesando) return

    setProcesando(true)
    setErrorModal('')

    try {
      await oficinistasService.asignar(usuarioSeleccionado.id)

      limpiarModal()
      setMensaje('Oficinista asignado correctamente.')

      await cargar()
    } catch (err) {
      setErrorModal(
        mensajeError(
          err,
          'No se pudo asignar el oficinista.'
        )
      )
    } finally {
      setProcesando(false)
    }
  }

  // ACTIVAR O DESACTIVAR OFICINISTA

  const confirmarEstado = async () => {
    if (!oficinistaEstado || procesando) return

    const activar = !oficinistaEstado.activo

    setProcesando(true)
    setErrorModal('')

    try {
      await oficinistasService.cambiarEstado(
        oficinistaEstado.usuario_id,
        activar
      )

      limpiarModal()

      setMensaje(
        activar
          ? 'Oficinista activado correctamente.'
          : 'Oficinista desactivado correctamente.'
      )

      await cargar()
    } catch (err) {
      setErrorModal(
        mensajeError(
          err,
          'No se pudo cambiar el estado del oficinista.'
        )
      )
    } finally {
      setProcesando(false)
    }
  }

  return (
    <section>
      <div className="seccion-cab izq">
        <h2>Gestión de oficinistas</h2>
        <p>Administra el personal de tu cooperativa.</p>
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

      {/* LISTADO PRINCIPAL */}

      <div className="panel">
        <div className="of-barra">
          <div>
            <h4>Personal registrado</h4>
            <p className="muted">
              Consulta y administra las cuentas de oficinistas.
            </p>
          </div>

          <div className="of-acciones">
            <button
              type="button"
              className="btn btn-oscuro"
              onClick={abrirCrear}
            >
              + Crear oficinista
            </button>

            <button
              type="button"
              className="btn btn-claro"
              onClick={abrirAsignar}
            >
              Asignar existente
            </button>

            <button
              type="button"
              className="btn btn-claro"
              disabled={cargando}
              onClick={() => {
                setMensaje('')
                cargar()
              }}
            >
              {cargando ? 'Actualizando...' : 'Actualizar'}
            </button>
          </div>
        </div>

        {/* FILTROS */}

        <div className="of-filtros">
          <div className="of-campo">
            <label htmlFor="filtro-oficinistas">
              Buscar oficinista
            </label>

            <input
              id="filtro-oficinistas"
              type="search"
              placeholder="Nombre, apellido o correo"
              value={filtroBusqueda}
              onChange={(evento) =>
                setFiltroBusqueda(evento.target.value)
              }
            />
          </div>

          <div className="of-campo">
            <label htmlFor="estado-oficinistas">
              Estado
            </label>

            <select
              id="estado-oficinistas"
              value={filtroEstado}
              onChange={(evento) =>
                setFiltroEstado(evento.target.value)
              }
            >
              <option value="todos">Todos</option>
              <option value="activos">Activos</option>
              <option value="inactivos">Inactivos</option>
            </select>
          </div>

          <button
            type="button"
            className="btn btn-claro"
            disabled={
              filtroBusqueda === '' &&
              filtroEstado === 'todos'
            }
            onClick={limpiarFiltros}
          >
            Limpiar filtros
          </button>
        </div>

        <p className="muted" role="status">
          Mostrando {oficinistasFiltrados.length} de{' '}
          {oficinistas.length} oficinistas
        </p>

        {/* TABLA PRINCIPAL */}

        {cargando ? (
          <p className="muted">
            Cargando oficinistas...
          </p>
        ) : error && oficinistas.length === 0 ? (
          <div className="vacio">
            No se pudo cargar el listado.
          </div>
        ) : oficinistas.length === 0 ? (
          <div className="vacio">
            <b>No hay oficinistas registrados.</b>
            <p>
              Utiliza Crear oficinista o Asignar existente.
            </p>
          </div>
        ) : oficinistasFiltrados.length === 0 ? (
          <div className="vacio">
            <b>No se encontraron oficinistas.</b>
            <p>
              Prueba otra búsqueda o cambia el filtro de estado.
            </p>
          </div>
        ) : (
          <div className="tabla-wrap">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Oficinista</th>
                  <th>Correo</th>
                  <th>Teléfono</th>
                  <th>Verificación</th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>

              <tbody>
                {oficinistasFiltrados.map((oficinista) => {
                  const usuario = oficinista.usuarios

                  const verificado = Boolean(
                    usuario.correo_verificado_en
                  )

                  return (
                    <tr
                      key={oficinista.usuario_id}
                      className={
                        oficinista.activo ? '' : 'inactiva'
                      }
                    >
                      <td>
                        <b>
                          {usuario.nombres} {usuario.apellidos}
                        </b>
                      </td>

                      <td>{usuario.correo}</td>

                      <td>{usuario.telefono}</td>

                      <td>
                        <span
                          className={
                            'badge ' +
                            (verificado ? 'verde' : 'gris')
                          }
                        >
                          {verificado
                            ? 'Verificado'
                            : 'Pendiente'}
                        </span>
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
                            !usuario.activo ||
                            !verificado
                          }
                          onClick={() =>
                            abrirEstado(oficinista)
                          }
                        >
                          {oficinista.activo
                            ? 'Desactivar'
                            : 'Activar'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: CREAR OFICINISTA */}

      {modal === 'crear' && (
        <Modal
          titulo="Crear nuevo oficinista"
          descripcion="Registra una cuenta para el personal de tu cooperativa."
          onCerrar={cerrarModal}
          bloqueado={procesando}
        >
          {errorModal && (
            <div className="aviso-hoja mal" role="alert">
              {errorModal}
            </div>
          )}

          <form onSubmit={registrarNuevo}>
            <div className="of-form-grid">
              <div className="of-campo">
                <label htmlFor="of-nombres">
                  Nombres
                </label>

                <input
                  id="of-nombres"
                  name="nombres"
                  required
                  maxLength={100}
                  autoComplete="given-name"
                  value={nuevoOficinista.nombres}
                  onChange={actualizarCampo}
                  disabled={procesando}
                />
              </div>

              <div className="of-campo">
                <label htmlFor="of-apellidos">
                  Apellidos
                </label>

                <input
                  id="of-apellidos"
                  name="apellidos"
                  required
                  maxLength={100}
                  autoComplete="family-name"
                  value={nuevoOficinista.apellidos}
                  onChange={actualizarCampo}
                  disabled={procesando}
                />
              </div>

              <div className="of-campo of-campo--completo">
                <label htmlFor="of-correo">
                  Correo electrónico
                </label>

                <input
                  id="of-correo"
                  name="correo"
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="email"
                  value={nuevoOficinista.correo}
                  onChange={actualizarCampo}
                  disabled={procesando}
                />
              </div>

              <div className="of-campo">
                <label htmlFor="of-cedula">
                  Cédula
                </label>

                <input
                  id="of-cedula"
                  name="numero_documento"
                  inputMode="numeric"
                  pattern="[0-9]{10}"
                  title="Ingresa exactamente 10 dígitos"
                  required
                  maxLength={10}
                  value={nuevoOficinista.numero_documento}
                  onChange={actualizarCampo}
                  disabled={procesando}
                />
              </div>

              <div className="of-campo">
                <label htmlFor="of-telefono">
                  Celular
                </label>

                <input
                  id="of-telefono"
                  name="telefono"
                  type="tel"
                  inputMode="numeric"
                  pattern="09[0-9]{8}"
                  title="Debe comenzar con 09 y tener 10 dígitos"
                  required
                  maxLength={10}
                  autoComplete="tel"
                  value={nuevoOficinista.telefono}
                  onChange={actualizarCampo}
                  disabled={procesando}
                />
              </div>

              <div className="of-campo of-campo--completo">
                <label htmlFor="of-clave">
                  Contraseña inicial
                </label>

                <input
                  id="of-clave"
                  name="clave"
                  type="password"
                  minLength={12}
                  required
                  autoComplete="new-password"
                  value={nuevoOficinista.clave}
                  onChange={actualizarCampo}
                  disabled={procesando}
                />

                <small className="muted">
                  Mínimo 12 caracteres y máximo 72 bytes.
                </small>
              </div>
            </div>

            <div className="of-modal-pie">
              <button
                type="button"
                className="btn btn-claro"
                onClick={cerrarModal}
                disabled={procesando}
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="btn btn-oscuro"
                disabled={procesando}
              >
                {procesando
                  ? 'Registrando...'
                  : 'Registrar oficinista'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: ASIGNAR USUARIO EXISTENTE */}

      {modal === 'asignar' && (
        <Modal
          titulo="Asignar usuario existente"
          descripcion="Busca una cuenta disponible y asígnala como oficinista."
          onCerrar={cerrarModal}
          bloqueado={procesando}
          ancho="amplio"
        >
          {errorModal && (
            <div className="aviso-hoja mal" role="alert">
              {errorModal}
            </div>
          )}

          <div className="of-campo">
            <label htmlFor="of-buscar">
              Buscar usuario
            </label>

            <input
              id="of-buscar"
              type="search"
              placeholder="Nombre, apellido, correo o documento"
              maxLength={100}
              value={busqueda}
              disabled={procesando}
              onChange={(evento) => {
                setBusqueda(evento.target.value)
                setPagina(1)
                setUsuarioSeleccionado(null)
                setUsuariosDisponibles([])
                setCargandoUsuarios(true)
              }}
            />
          </div>

          {cargandoUsuarios ? (
            <p className="muted">
              Buscando usuarios...
            </p>
          ) : errorModal ? null : usuariosDisponibles.length === 0 ? (
            <div className="vacio">
              No se encontraron usuarios disponibles.
            </div>
          ) : (
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
                            (usuarioSeleccionado?.id === usuario.id
                              ? 'btn-oscuro'
                              : 'btn-claro')
                          }
                          disabled={procesando}
                          onClick={() =>
                            setUsuarioSeleccionado(usuario)
                          }
                        >
                          {usuarioSeleccionado?.id === usuario.id
                            ? 'Seleccionado'
                            : 'Seleccionar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!errorModal && (
            <div className="of-paginacion">
              <button
                type="button"
                className="btn btn-claro"
                disabled={
                  pagina <= 1 ||
                  cargandoUsuarios ||
                  procesando
                }
                onClick={() => {
                  setPagina((actual) => actual - 1)
                  setUsuarioSeleccionado(null)
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
                  cargandoUsuarios ||
                  procesando
                }
                onClick={() => {
                  setPagina((actual) => actual + 1)
                  setUsuarioSeleccionado(null)
                  setUsuariosDisponibles([])
                  setCargandoUsuarios(true)
                }}
              >
                Siguiente
              </button>
            </div>
          )}

          {usuarioSeleccionado && (
            <div className="of-seleccion">
              <strong>
                {usuarioSeleccionado.nombres}{' '}
                {usuarioSeleccionado.apellidos}
              </strong>

              <p className="muted">
                Se asignará como oficinista de tu cooperativa.
              </p>
            </div>
          )}

          <div className="of-modal-pie">
            <button
              type="button"
              className="btn btn-claro"
              disabled={procesando}
              onClick={cerrarModal}
            >
              Cancelar
            </button>

            <button
              type="button"
              className="btn btn-oscuro"
              disabled={
                !usuarioSeleccionado ||
                procesando ||
                cargandoUsuarios
              }
              onClick={asignarExistente}
            >
              {procesando
                ? 'Asignando...'
                : 'Confirmar asignación'}
            </button>
          </div>
        </Modal>
      )}

      {/* MODAL: ACTIVAR O DESACTIVAR */}

      {modal === 'estado' && oficinistaEstado && (
        <Modal
          titulo={
            oficinistaEstado.activo
              ? 'Desactivar oficinista'
              : 'Activar oficinista'
          }
          descripcion="Confirma el cambio de estado del personal."
          onCerrar={cerrarModal}
          bloqueado={procesando}
        >
          {errorModal && (
            <div className="aviso-hoja mal" role="alert">
              {errorModal}
            </div>
          )}

          <p>
            ¿Deseas{' '}
            <strong>
              {oficinistaEstado.activo
                ? 'desactivar'
                : 'activar'}
            </strong>{' '}
            a{' '}
            <strong>
              {oficinistaEstado.usuarios.nombres}{' '}
              {oficinistaEstado.usuarios.apellidos}
            </strong>
            ?
          </p>

          <p className="muted">
            {oficinistaEstado.activo
              ? 'La persona dejará de tener activa su asignación como oficinista.'
              : 'La asignación como oficinista volverá a estar activa.'}
          </p>

          <div className="of-modal-pie">
            <button
              type="button"
              className="btn btn-claro"
              disabled={procesando}
              onClick={cerrarModal}
            >
              Cancelar
            </button>

            <button
              type="button"
              className="btn btn-oscuro"
              disabled={procesando}
              onClick={confirmarEstado}
            >
              {procesando
                ? 'Guardando...'
                : oficinistaEstado.activo
                  ? 'Confirmar desactivación'
                  : 'Confirmar activación'}
            </button>
          </div>
        </Modal>
      )}
    </section>
  )
}
