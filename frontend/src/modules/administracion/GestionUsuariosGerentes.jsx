import { useEffect, useState } from 'react'
import { administracionService } from './services/administracion.service'

function Usuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [gerentes, setGerentes] = useState([])
  const [cooperativas, setCooperativas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [errorModal, setErrorModal] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [filtroRol, setFiltroRol] = useState('todos')
const [filtroCooperativa, setFiltroCooperativa] = useState('todas')
const [filtroCorreo, setFiltroCorreo] = useState('todos')
  const [vista, setVista] = useState('usuarios')
  const [modal, setModal] = useState(null)
  const [seleccionado, setSeleccionado] = useState(null)
  const [cooperativaId, setCooperativaId] = useState('')
  const [usuarioId, setUsuarioId] = useState('')

  const [edicion, setEdicion] = useState({
    nombres: '',
    apellidos: '',
    telefono: '',
  })

  const [nuevo, setNuevo] = useState({
    nombres: '',
    apellidos: '',
    correo: '',
    numero_documento: '',
    telefono: '',
    clave: '',
    cooperativa_id: '',
  })

  const nombre = (u) =>
    `${u?.nombres || ''} ${u?.apellidos || ''}`.trim()

  const normalizarRol = (rol) =>
    String(rol || '').trim().toUpperCase()

  const esAdministrador = (u) =>
    (u?.roles_globales || []).some(
      (r) => ['ADMIN', 'ADMINISTRADOR'].includes(normalizarRol(r.rol))
    )


const rolesUsuario = (u) => {
  const rolesGlobales = (u?.roles_globales || [])
    .map((r) => String(r.rol || '').toUpperCase())

  const cargosActivos = (u?.miembros_cooperativa || [])
    .filter((m) => m.activo)
    .map((m) => String(m.rol || '').toUpperCase())

  const roles = []

  if (
    rolesGlobales.includes('ADMINISTRADOR') ||
    rolesGlobales.includes('ADMIN')
  ) {
    roles.push('Administrador')
  }

  if (cargosActivos.includes('GERENTE')) {
    roles.push('Gerente')
  }

  if (cargosActivos.includes('OFICINISTA')) {
    roles.push('Oficinista')
  }

  // Un gerente activo no se muestra como cliente.
  if (
    rolesGlobales.includes('CLIENTE') &&
    !cargosActivos.includes('GERENTE')
  ) {
    roles.push('Cliente')
  }

  return [...new Set(roles)]
}

const usuarioDeGerente = (g) =>
  usuarios.find((u) => u.id === g?.usuario_id) || null

const cooperativaCoincide = (u) =>
  filtroCooperativa === 'todas' ||
  (u?.miembros_cooperativa || []).some(
    (m) =>
      m.activo &&
      m.cooperativa_id === filtroCooperativa
  )

const correoCoincide = (u) =>
  filtroCorreo === 'todos' ||
  (filtroCorreo === 'verificados' && !!u?.correo_verificado_en) ||
  (filtroCorreo === 'pendientes' && !u?.correo_verificado_en)

const reiniciarFiltros = () => {
  setBusqueda('')
  setFiltro('todos')
  setFiltroRol('todos')
  setFiltroCooperativa('todas')
  setFiltroCorreo('todos')
}


  const activas = cooperativas.filter((c) => c.activa)

  const disponibles = usuarios.filter(
    (u) =>
      u.activo &&
      u.correo_verificado_en &&
      !esAdministrador(u) &&
      !(u.miembros_cooperativa || []).some((m) => m.activo)
  )

  async function cargarDatos() {
    setCargando(true)
    setError('')

    const resultados = await Promise.allSettled([
      administracionService.listarUsuariosAdmin(),
      administracionService.obtenerGerentes(),
      obtenerCooperativas(),
    ])

    const [u, g, c] = resultados

    if (u.status === 'fulfilled') setUsuarios(u.value)
    if (g.status === 'fulfilled') setGerentes(g.value)
    if (c.status === 'fulfilled') setCooperativas(c.value)

    const fallos = resultados
      .map((r, i) =>
        r.status === 'rejected'
          ? `${['Usuarios', 'Gerentes', 'Cooperativas'][i]}: ${
              r.reason?.message || 'Error desconocido'
            }`
          : null
      )
      .filter(Boolean)

    if (fallos.length) setError(fallos.join(' | '))
    setCargando(false)
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  function abrir(tipo, registro = null) {
    setError('')
    setErrorModal('')
    setMensaje('')
    setSeleccionado(registro)
    setModal(tipo)
    setCooperativaId(registro?.cooperativa_id || '')
    setUsuarioId(registro?.id || '')

    if (tipo === 'editarUsuario' && registro) {
      setEdicion({
        nombres: registro.nombres || '',
        apellidos: registro.apellidos || '',
        telefono: registro.telefono || '',
      })
    }

    if (tipo === 'crear') {
      setNuevo({
        nombres: '',
        apellidos: '',
        correo: '',
        numero_documento: '',
        telefono: '',
        clave: '',
        cooperativa_id: '',
      })
    }
  }

  function cerrar() {
    if (guardando) return
    setModal(null)
    setSeleccionado(null)
    setErrorModal('')
  }

  async function ejecutarOperacion(operacion, texto) {
    if (guardando) return

    setGuardando(true)
    setErrorModal('')
    setError('')

    try {
      await operacion()
      setModal(null)
      setSeleccionado(null)
      setMensaje(texto)
      await cargarDatos()
    } catch (err) {
      setErrorModal(
        err?.message || 'No se pudo completar la operación.'
      )
    } finally {
      setGuardando(false)
    }
  }

 const gerentesUnicos = Array.from(
  gerentes.reduce((mapa, asignacion) => {
    const id = asignacion.usuario_id
    const anterior = mapa.get(id)

    if (!anterior || (asignacion.activo && !anterior.activo)) {
      mapa.set(id, asignacion)
    }

    return mapa
  }, new Map()).values()
)

function historialGerente(usuarioId) {
  return gerentes
    .filter((g) => g.usuario_id === usuarioId)
    .sort((a, b) => Number(b.activo) - Number(a.activo))
}

  const gerentesFiltrados = gerentesUnicos.filter((g) => {
  const texto = busqueda.toLowerCase().trim()
  const usuario = usuarioDeGerente(g)
  const asignaciones = historialGerente(g.usuario_id)
const asignacionActiva = asignaciones.find((a) => a.activo)

  const coincideBusqueda = [
    nombre(g.usuarios),
    g.usuarios?.correo,
    usuario?.numero_documento,
    ...asignaciones.map((a) => a.cooperativas?.nombre_comercial),
  ].some((valor) =>
    String(valor || '').toLowerCase().includes(texto)
  )

  const coincideEstado =
  filtro === 'todos' ||
  (filtro === 'activos' && !!asignacionActiva) ||
  (filtro === 'inactivos' && !asignacionActiva)

  const coincideCooperativa =
  filtroCooperativa === 'todas' ||
  asignaciones.some(
    (a) => a.cooperativa_id === filtroCooperativa
  )

  const coincideCorreo =
    filtroCorreo === 'todos' ||
    (filtroCorreo === 'verificados' &&
      !!g.usuarios?.correo_verificado_en) ||
    (filtroCorreo === 'pendientes' &&
      !g.usuarios?.correo_verificado_en)

  return (
    coincideBusqueda &&
    coincideEstado &&
    coincideCooperativa &&
    coincideCorreo
  )
})

const usuariosFiltrados = usuarios.filter((u) => {
  const texto = busqueda.toLowerCase().trim()

  const coincideBusqueda = [
    nombre(u),
    u.correo,
    u.numero_documento,
    rolesUsuario(u).join(' '),
  ].some((valor) =>
    String(valor || '').toLowerCase().includes(texto)
  )

  const coincideEstado =
    filtro === 'todos' ||
    (filtro === 'activos' && u.activo) ||
    (filtro === 'inactivos' && !u.activo)

  const coincideRol =
    filtroRol === 'todos' ||
    rolesUsuario(u).some(
      (rol) => rol.toLowerCase() === filtroRol
    )

  return (
    coincideBusqueda &&
    coincideEstado &&
    coincideRol &&
    cooperativaCoincide(u) &&
    correoCoincide(u)
  )
})

  const campo = (etiqueta, propiedad, tipo = 'text') => (
    <label className="gm-campo" key={propiedad}>
      <span>{etiqueta}</span>
      <input
        required
        type={tipo}
        value={nuevo[propiedad]}
        maxLength={
          ['numero_documento', 'telefono'].includes(propiedad)
            ? 10
            : propiedad === 'clave' ? 72 : 254
        }
        minLength={propiedad === 'clave' ? 12 : undefined}
        onChange={(e) =>
          setNuevo((anterior) => ({
            ...anterior,
            [propiedad]:
              ['telefono', 'numero_documento'].includes(propiedad)
                ? e.target.value.replace(/\D/g, '').slice(0, 10)
                : e.target.value,
          }))
        }
      />
    </label>
  )

  const selectorCooperativa = (valor, cambiar) => (
    <label className="gm-campo">
      <span>Cooperativa</span>
      <select
        required
        value={valor}
        onChange={(e) => cambiar(e.target.value)}
      >
        <option value="">Seleccionar cooperativa</option>
        {activas.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre_comercial}
          </option>
        ))}
      </select>
    </label>
  )

  const detalle = (etiqueta, valor) => (
    <div className="gm-detalle">
      <span>{etiqueta}</span>
      <strong>{valor || 'No registrado'}</strong>
    </div>
  )

  const fecha = (valor) =>
    valor ? new Date(valor).toLocaleDateString('es-EC') : 'No registrada'

  const titulosModal = {

    crear: 'Registrar nuevo gerente',
    asignar: 'Asignar gerente existente',
    cambiar: 'Cambiar cooperativa',
    estado: 'Cambiar estado del gerente',
    detalleUsuario: 'Detalles del usuario',
    editarUsuario: 'Editar usuario',
    estadoUsuario: 'Cambiar estado de la cuenta',
    detalleGerente: 'Detalles del gerente',
  }

  return (
    <div className="gm-panel">
      <style>{`
        .gm-panel { display:grid; gap:22px; padding:8px 0 30px; }
        .gm-cabecera { display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; }
        .gm-cabecera h2 { margin:0 0 6px; color:#172d4c; font-size:23px; }
        .gm-cabecera p { margin:0; color:#64748b; }
        .gm-acciones { display:flex; gap:10px; flex-wrap:wrap; }
        .gm-btn { border:1px solid #d6dfeb; border-radius:10px; padding:11px 16px; background:white; color:#203a5b; font:inherit; font-weight:650; cursor:pointer; }
        .gm-btn:hover:not(:disabled) { background:#f0f5fa; }
        .gm-btn:disabled { opacity:.55; cursor:not-allowed; }
        .gm-btn.primario { background:#1d426e; color:white; border-color:#1d426e; }
        .gm-btn.primario:hover:not(:disabled) { background:#153457; }
        .gm-btn.peligro { color:#a52c35; border-color:#e8c5c8; }
        .gm-resumen { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:14px; }
        .gm-resumen article { border:1px solid #e4e8ef; border-radius:14px; background:white; padding:20px; }
        .gm-resumen span { display:block; color:#64748b; font-size:13px; }
        .gm-resumen strong { display:block; color:#172d4c; font-size:29px; margin-top:7px; }
        .gm-superficie { background:white; border:1px solid #e4e8ef; border-radius:14px; overflow:hidden; }
        .gm-barra { padding:18px; display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; border-bottom:1px solid #edf0f4; }
        .gm-pestanas { display:flex; gap:8px; flex-wrap:wrap; }
        .gm-pestanas button { padding:10px 14px; border:0; background:transparent; cursor:pointer; color:#64748b; font-weight:650; border-radius:8px; }
        .gm-pestanas button.activa { background:#eaf1f9; color:#1d426e; }
        .gm-filtros { display:flex; gap:10px; flex-wrap:wrap; }
        .gm-filtros input, .gm-filtros select { padding:11px 12px; border:1px solid #cbd5e1; border-radius:9px; font:inherit; background:white; color:#203040; min-width:0; }
        .gm-filtros input { width:min(270px,100%); }
        .gm-tabla-wrap { width:100%; overflow-x:auto; }
        .gm-tabla { width:100%; border-collapse:collapse; text-align:left; }
        .gm-tabla th { background:#f8f6f1; color:#64748b; font-size:12px; letter-spacing:.04em; text-transform:uppercase; }
        .gm-tabla th, .gm-tabla td { padding:15px 18px; border-bottom:1px solid #edf0f4; vertical-align:middle; }
        .gm-tabla td { font-size:14px; }
        .gm-tabla tr:last-child td { border-bottom:0; }
        .gm-tabla td strong { color:#172d4c; }
        .gm-etiqueta { display:inline-block; border-radius:999px; padding:5px 10px; background:#eef2f7; color:#526174; font-size:12px; font-weight:650; }
        .gm-etiqueta.ok { background:#e6f5eb; color:#217348; }
        .gm-etiqueta.no { background:#fff0e8; color:#a65426; }
        .gm-roles { display:flex; gap:5px; flex-wrap:wrap; }
        .gm-fila-acciones { display:flex; gap:7px; flex-wrap:wrap; }
        .gm-fila-acciones .gm-btn { padding:7px 10px; font-size:12px; }
        .gm-vacio { padding:35px 18px; text-align:center; color:#64748b; }
        .gm-alerta { padding:13px 16px; border-radius:10px; background:#fff1f0; color:#9b2e35; overflow-wrap:anywhere; }
        .gm-alerta.exito { background:#eaf7ed; color:#226c42; }
        .gm-overlay { position:fixed; inset:0; background:rgba(15,23,42,.55); display:flex; align-items:center; justify-content:center; padding:18px; z-index:2000; }
        .gm-modal { background:white; width:min(650px,100%); max-height:90vh; overflow-y:auto; border-radius:16px; box-shadow:0 24px 70px rgba(0,0,0,.22); }
        .gm-modal-cabecera { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; padding:23px 25px; border-bottom:1px solid #edf0f4; }
        .gm-modal-cabecera h3 { margin:0 0 5px; color:#172d4c; font-size:20px; }
        .gm-modal-cabecera p { margin:0; color:#64748b; font-size:14px; }
        .gm-cerrar { border:0; background:#f1f5f9; border-radius:8px; padding:7px 11px; cursor:pointer; }
        .gm-modal-cuerpo { padding:24px 25px; }
        .gm-form-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
        .gm-campo { display:grid; gap:7px; font-size:14px; font-weight:600; color:#34465e; }
        .gm-campo input, .gm-campo select { width:100%; box-sizing:border-box; border:1px solid #cbd5e1; border-radius:9px; padding:12px; background:white; color:#172d4c; font:inherit; font-weight:400; }
        .gm-campo input:focus, .gm-campo select:focus { outline:2px solid #9bbce0; border-color:#4f7cac; }
        .gm-modal-pie { display:flex; justify-content:flex-end; gap:10px; padding:17px 25px; border-top:1px solid #edf0f4; }
        .gm-ayuda { color:#64748b; font-size:13px; line-height:1.6; margin:0 0 18px; }
        .gm-detalle { display:grid; gap:5px; overflow-wrap:anywhere; }
        .gm-detalle span { font-size:12px; color:#64748b; }
        .gm-detalle strong { font-size:14px; color:#172d4c; }
        .gm-seccion { margin:20px 0 12px; color:#172d4c; font-size:15px; }
        @media(max-width:650px) {
          .gm-resumen { grid-template-columns:1fr; }
          .gm-form-grid { grid-template-columns:1fr; }
          .gm-cabecera { align-items:stretch; }
          .gm-barra { align-items:stretch; }
          .gm-filtros { flex-direction:column; }
          .gm-filtros input { width:100%; box-sizing:border-box; }
          .gm-modal-cuerpo { padding:18px; }
        }
      `}</style>

      <div className="gm-cabecera">
        <div>
          <h2>Usuarios y gerentes</h2>
          <p>Gestiona las cuentas y sus asignaciones a cooperativas.</p>
        </div>

        <div className="gm-acciones">
          <button
            type="button"
            className="gm-btn"
            onClick={cargarDatos}
            disabled={cargando || guardando}
          >
            {cargando ? 'Actualizando...' : 'Actualizar'}
          </button>

          <button
            type="button"
            className="gm-btn"
            onClick={() => abrir('asignar')}
          >
            Asignar existente
          </button>

          <button
            type="button"
            className="gm-btn primario"
            onClick={() => abrir('crear')}
          >
            + Nuevo gerente
          </button>
        </div>
      </div>

      {error && <div className="gm-alerta" role="alert">{error}</div>}
      {mensaje && <div className="gm-alerta exito" role="status">{mensaje}</div>}

      <div className="gm-resumen">
        <article>
          <span>Usuarios registrados</span>
          <strong>{usuarios.length}</strong>
        </article>

        <article>
          <span>Gerentes activos</span>
          <strong>{gerentes.filter((g) => g.activo).length}</strong>
        </article>

        <article>
          <span>Cooperativas activas</span>
          <strong>{activas.length}</strong>
        </article>


<article>
  <span>Cuentas activas</span>
  <strong>{usuarios.filter((u) => u.activo).length}</strong>
</article>

<article>
  <span>Cuentas inactivas</span>
  <strong>{usuarios.filter((u) => !u.activo).length}</strong>
</article>

<article>
  <span>Correos pendientes</span>
  <strong>
    {usuarios.filter((u) => !u.correo_verificado_en).length}
  </strong>
</article>

      </div>

      <div className="gm-superficie">
        <div className="gm-barra">
          <div className="gm-pestanas">
            <button
              type="button"
              className={vista === 'usuarios' ? 'activa' : ''}
              onClick={() => {
                setVista('usuarios')
                setBusqueda('')
                setFiltro('todos')
              }}
            >
              Todos los usuarios
            </button>

            <button
              type="button"
              className={vista === 'gerentes' ? 'activa' : ''}
              onClick={() => {
                setVista('gerentes')
                setBusqueda('')
                setFiltro('todos')
              }}
            >
              Gerentes
            </button>
          </div>

          <div className="gm-filtros">
            <input
              type="search"
              placeholder="Buscar por nombre, correo o documento..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />

            <select
  aria-label="Filtrar por estado"
  value={filtro}
  onChange={(e) => setFiltro(e.target.value)}
>
  <option value="todos">Todos los estados</option>
  <option value="activos">Activos</option>
  <option value="inactivos">Inactivos</option>
</select>

{vista === 'usuarios' && (
  <select
    aria-label="Filtrar por rol"
    value={filtroRol}
    onChange={(e) => setFiltroRol(e.target.value)}
  >
    <option value="todos">Todos los roles</option>
    <option value="administrador">Administrador</option>
    <option value="gerente">Gerente</option>
    <option value="oficinista">Oficinista</option>
    <option value="cliente">Cliente</option>
  </select>
)}

<select
  aria-label="Filtrar por cooperativa"
  value={filtroCooperativa}
  onChange={(e) => setFiltroCooperativa(e.target.value)}
>
  <option value="todas">Todas las cooperativas</option>
  {cooperativas.map((c) => (
    <option key={c.id} value={c.id}>
      {c.nombre_comercial}
    </option>
  ))}
</select>

<select
  aria-label="Filtrar por verificación"
  value={filtroCorreo}
  onChange={(e) => setFiltroCorreo(e.target.value)}
>
  <option value="todos">Todos los correos</option>
  <option value="verificados">Correo verificado</option>
  <option value="pendientes">Correo pendiente</option>
</select>

<button
  type="button"
  className="gm-btn"
  onClick={reiniciarFiltros}
>
  Limpiar filtros
</button>
          </div>
        </div>

        <div className="gm-tabla-wrap">
          {vista === 'usuarios' ? (
            <table className="gm-tabla">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Documento</th>
                  <th>Rol</th>
                  <th>Cuenta</th>
                  <th>Cooperativa</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {usuariosFiltrados.map((u) => {
                  const asignaciones = (u.miembros_cooperativa || [])
                    .filter((m) => m.activo)

                  const roles = rolesUsuario(u)

                  return (
                    <tr key={u.id}>
                      <td>
                        <strong>{nombre(u)}</strong>
                        <div className="muted">{u.correo}</div>
                      </td>

                      <td>{u.numero_documento}</td>

                      <td>
                        <div className="gm-roles">
                          {roles.length ? roles.map((rol) => (
                            <span className="gm-etiqueta" key={rol}>
                              {rol}
                            </span>
                          )) : (
                            <span className="gm-etiqueta">
                              Sin rol activo
                            </span>
                          )}
                        </div>
                      </td>

                      <td>
                        <span
                          className={`gm-etiqueta ${u.activo ? 'ok' : 'no'}`}
                        >
                          {u.activo ? 'Activa' : 'Inactiva'}
                        </span>
                        <div className="muted">
                          {u.correo_verificado_en
                            ? 'Correo verificado'
                            : 'Correo sin verificar'}
                        </div>
                      </td>

                      <td>
                        {asignaciones.length
                          ? asignaciones.map((m) =>
                              m.cooperativas?.nombre_comercial ||
                              'Cooperativa no disponible'
                            ).join(', ')
                          : 'Sin asignación activa'}
                      </td>

                      <td>
                        <div className="gm-fila-acciones">
                          <button
                            type="button"
                            className="gm-btn"
                            onClick={() => abrir('detalleUsuario', u)}
                          >
                            Ver
                          </button>

                          <button
                            type="button"
                            className="gm-btn"
                            onClick={() => abrir('editarUsuario', u)}
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            className={`gm-btn ${u.activo ? 'peligro' : ''}`}
                            disabled={esAdministrador(u)}
                            title={
                              esAdministrador(u)
                                ? 'Las cuentas administrativas están protegidas'
                                : ''
                            }
                            onClick={() => abrir('estadoUsuario', u)}
                          >
                            {u.activo ? 'Desactivar' : 'Activar'}
                          </button>

                          <button
                            type="button"
                            className="gm-btn"
                            disabled={!disponibles.some((d) => d.id === u.id)}
                            onClick={() => abrir('asignar', u)}
                          >
                            Hacer gerente
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <table className="gm-tabla">
              <thead>
                <tr>
                  <th>Gerente</th>
                  <th>Cooperativa</th>
                  <th>Asignación</th>
                  <th>Cuenta</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {gerentesFiltrados.map((g) => (
                  <tr key={g.usuario_id}>
                    <td>
                      <strong>{nombre(g.usuarios)}</strong>
                      <div className="muted">{g.usuarios.correo}</div>
                    </td>

                    <td>
  {g.activo
    ? g.cooperativas?.nombre_comercial || 'Cooperativa sin nombre'
    : 'Sin cooperativa activa'}
</td>

                    <td>
                      <span className={`gm-etiqueta ${g.activo ? 'ok' : 'no'}`}>
                        {g.activo ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>

                    <td>
                      <span className={`gm-etiqueta ${g.usuarios.activo ? 'ok' : 'no'}`}>
                        {g.usuarios.activo ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>

                    <td>
                      <div className="gm-fila-acciones">


<button
  type="button"
  className="gm-btn"
  onClick={() => abrir('detalleGerente', g)}
>
  Ver
</button>

<button
  type="button"
  className="gm-btn"
  disabled={!usuarioDeGerente(g)}
  onClick={() => {
    const usuario = usuarioDeGerente(g)
    if (usuario) abrir('editarUsuario', usuario)
  }}
>
  Editar
</button>

                        <button
                          type="button"
                          className="gm-btn"
                          disabled={!g.activo}
                          onClick={() => abrir('cambiar', g)}
                        >
                          Cambiar cooperativa
                        </button>

                        <button
                          type="button"
                          className="gm-btn"
                          onClick={() => abrir('estado', g)}
                        >
                          {g.activo ? 'Desactivar cargo' : 'Activar cargo'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!cargando &&
          (vista === 'usuarios'
            ? usuariosFiltrados.length === 0
            : gerentesFiltrados.length === 0) && (
            <div className="gm-vacio">
              No hay registros para mostrar.
            </div>
          )}

        {cargando && (
          <div className="gm-vacio">Cargando información...</div>
        )}
      </div>

      {modal && (
        <div
          className="gm-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) cerrar()
          }}
        >
          <div
            className="gm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="gm-modal-titulo"
          >
            <div className="gm-modal-cabecera">
              <div>
                <h3 id="gm-modal-titulo">
                  {titulosModal[modal]}

                </h3>
                <p>Administración de RutaEC</p>
              </div>

              <button
                type="button"
                className="gm-cerrar"
                onClick={cerrar}
                disabled={guardando}
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            {errorModal && (
              <div
                className="gm-alerta"
                role="alert"
                style={{ margin: '16px 24px 0' }}
              >
                {errorModal}
              </div>
            )}


{modal === 'detalleGerente' && seleccionado && (
  <>
    <div className="gm-modal-cuerpo">
      <h4 className="gm-seccion">Información personal</h4>

      <div className="gm-form-grid">
        {detalle(
          'Nombre completo',
          nombre(seleccionado.usuarios)
        )}
        {detalle(
          'Correo electrónico',
          seleccionado.usuarios?.correo
        )}
        {detalle(
          'Documento',
          usuarioDeGerente(seleccionado)?.numero_documento
        )}
        {detalle(
          'Celular',
          seleccionado.usuarios?.telefono
        )}
      </div>

      <h4 className="gm-seccion">Cooperativa actual</h4>

      <div className="gm-form-grid">
        {detalle(
  'Cooperativa',
  seleccionado.activo
    ? seleccionado.cooperativas?.nombre_comercial
    : 'Sin cooperativa activa'
)}
        {detalle(
          'Estado del cargo',
          seleccionado.activo ? 'Activo' : 'Inactivo'
        )}
        {detalle(
          'Estado de la cuenta',
          seleccionado.usuarios?.activo ? 'Activa' : 'Inactiva'
        )}
        {detalle(
          'Correo electrónico',
          seleccionado.usuarios?.correo_verificado_en
            ? 'Verificado'
            : 'Pendiente de verificación'
        )}
        {detalle(
          'Fecha de asignación',
          fecha(seleccionado.asignado_en)
        )}
      </div>
    </div>

    <div className="gm-modal-pie">
      <button
        type="button"
        className="gm-btn"
        onClick={cerrar}
      >
        Cerrar
      </button>

      <button
        type="button"
        className="gm-btn primario"
        disabled={!usuarioDeGerente(seleccionado)}
        onClick={() => {
          const usuario = usuarioDeGerente(seleccionado)
          if (usuario) abrir('editarUsuario', usuario)
        }}
      >
        Editar gerente
      </button>
    </div>
  </>
)}


            {modal === 'detalleUsuario' && seleccionado && (
              <>
                <div className="gm-modal-cuerpo">
                  <h4 className="gm-seccion">Información personal</h4>

                  <div className="gm-form-grid">
                    {detalle('Nombre completo', nombre(seleccionado))}
                    {detalle('Correo electrónico', seleccionado.correo)}
                    {detalle('Tipo de documento', seleccionado.tipo_documento)}
                    {detalle('País del documento', seleccionado.pais_documento)}
                    {detalle('Número de documento', seleccionado.numero_documento)}
                    {detalle('Celular', seleccionado.telefono)}
                  </div>

                  <h4 className="gm-seccion">Cuenta y permisos</h4>

                  <div className="gm-form-grid">
                    {detalle(
                      'Roles',
                      rolesUsuario(seleccionado).join(', ') || 'Sin rol activo'
                    )}
                    {detalle(
                      'Estado',
                      seleccionado.activo ? 'Activa' : 'Inactiva'
                    )}
                    {detalle(
                      'Correo',
                      seleccionado.correo_verificado_en
                        ? 'Verificado'
                        : 'Pendiente de verificación'
                    )}
                    {detalle(
                      'Fecha de registro',
                      fecha(seleccionado.creado_en)
                    )}
                  </div>

                  <h4 className="gm-seccion">Asignaciones a cooperativas</h4>

                  {(seleccionado.miembros_cooperativa || []).length ? (
                    <div className="gm-form-grid">
                      {seleccionado.miembros_cooperativa.map((m, i) => (
                        <div className="gm-detalle" key={`${m.cooperativa_id}-${i}`}>
                          <span>{m.rol}</span>
                          <strong>
                            {m.cooperativas?.nombre_comercial ||
                              'Cooperativa no disponible'}
                          </strong>
                          <span>
                            {m.activo ? 'Asignación activa' : 'Asignación inactiva'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="gm-ayuda">No tiene asignaciones.</p>
                  )}

                  <h4 className="gm-seccion">Historial de cooperativas</h4>

<div style={{ display: 'grid', gap: 12 }}>
  {historialGerente(seleccionado.usuario_id).map((asignacion) => (
    <div
      key={`${asignacion.usuario_id}-${asignacion.cooperativa_id}`}
      style={{
        border: '1px solid var(--border, #d1d5db)',
        borderRadius: 10,
        padding: 14,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <strong>
            {asignacion.cooperativas?.nombre_comercial ||
              'Cooperativa sin nombre'}
          </strong>

          <div className="muted">
            Asignado: {fecha(asignacion.asignado_en)}
          </div>
        </div>

        <span
          className={`gm-etiqueta ${asignacion.activo ? 'ok' : 'no'}`}
        >
          {asignacion.activo ? 'Activo' : 'Inactivo'}
        </span>
      </div>

      <div style={{ marginTop: 12 }}>
        <button
          type="button"
          className={`gm-btn ${
            asignacion.activo ? 'peligro' : 'primario'
          }`}
          disabled={guardando}
          onClick={() => abrir('estado', asignacion)}
        >
          {asignacion.activo
            ? 'Desactivar cargo'
            : 'Activar cargo'}
        </button>
      </div>
    </div>
  ))}
</div>
                </div>

                <div className="gm-modal-pie">
                  <button
                    type="button"
                    className="gm-btn"
                    onClick={cerrar}
                  >
                    Cerrar
                  </button>

                  <button
                    type="button"
                    className="gm-btn primario"
                    onClick={() => abrir('editarUsuario', seleccionado)}
                  >
                    Editar usuario
                  </button>
                </div>
              </>
            )}

            {modal === 'editarUsuario' && seleccionado && (
              <form
                onSubmit={(e) => {
                  e.preventDefault()

                  ejecutarOperacion(
                    () => administracionService.editarUsuarioAdmin(
                      seleccionado.id,
                      {
                        nombres: edicion.nombres.trim(),
                        apellidos: edicion.apellidos.trim(),
                        telefono: edicion.telefono.trim(),
                      }
                    ),
                    'Usuario actualizado correctamente.'
                  )
                }}
              >
                <div className="gm-modal-cuerpo">
                  <p className="gm-ayuda">
                    Puedes modificar los nombres, apellidos y celular.
                    El correo, documento y contraseña no se modificarán.
                  </p>

                  <div className="gm-form-grid">
                    <label className="gm-campo">
                      <span>Nombres</span>
                      <input
                        required
                        maxLength={100}
                        value={edicion.nombres}
                        onChange={(e) =>
                          setEdicion((x) => ({
                            ...x,
                            nombres: e.target.value,
                          }))
                        }
                      />
                    </label>

                    <label className="gm-campo">
                      <span>Apellidos</span>
                      <input
                        required
                        maxLength={100}
                        value={edicion.apellidos}
                        onChange={(e) =>
                          setEdicion((x) => ({
                            ...x,
                            apellidos: e.target.value,
                          }))
                        }
                      />
                    </label>

                    <label className="gm-campo">
                      <span>Celular</span>
                      <input
                        required
                        inputMode="numeric"
                        pattern="09[0-9]{8}"
                        maxLength={10}
                        value={edicion.telefono}
                        onChange={(e) =>
                          setEdicion((x) => ({
                            ...x,
                            telefono: e.target.value
                              .replace(/\D/g, '')
                              .slice(0, 10),
                          }))
                        }
                      />
                    </label>
                  </div>
                </div>

                <div className="gm-modal-pie">
                  <button
                    type="button"
                    className="gm-btn"
                    onClick={cerrar}
                    disabled={guardando}
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    className="gm-btn primario"
                    disabled={guardando}
                  >
                    {guardando ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </div>
              </form>
            )}

            {modal === 'estadoUsuario' && seleccionado && (
              <>
                <div className="gm-modal-cuerpo">
                  <p>
                    ¿Confirmas que deseas{' '}
                    <strong>
                      {seleccionado.activo ? 'desactivar' : 'activar'}
                    </strong>{' '}
                    la cuenta de <strong>{nombre(seleccionado)}</strong>?
                  </p>

                  <p className="gm-ayuda">
                    {seleccionado.activo
                      ? 'La cuenta quedará inactiva. Esta acción no elimina los datos ni modifica las asignaciones de cooperativa.'
                      : 'La cuenta volverá a estar activa. Esto no modifica el estado de sus asignaciones de cooperativa.'}
                  </p>
                </div>

                <div className="gm-modal-pie">
                  <button
                    type="button"
                    className="gm-btn"
                    onClick={cerrar}
                    disabled={guardando}
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    className={`gm-btn ${
                      seleccionado.activo ? 'peligro' : 'primario'
                    }`}
                    disabled={guardando || esAdministrador(seleccionado)}
                    onClick={() =>
                      ejecutarOperacion(
                        () => administracionService.cambiarEstadoUsuarioAdmin(
                          seleccionado.id,
                          !seleccionado.activo
                        ),
                        'Estado de la cuenta actualizado correctamente.'
                      )
                    }
                  >
                    {guardando
                      ? 'Procesando...'
                      : seleccionado.activo
                        ? 'Sí, desactivar cuenta'
                        : 'Sí, activar cuenta'}
                  </button>
                </div>
              </>
            )}

            {modal === 'crear' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  ejecutarOperacion(
                    () => administracionService.crearGerente(nuevo),
                    'Gerente registrado correctamente.'
                  )
                }}
              >
                <div className="gm-modal-cuerpo">
                  <p className="gm-ayuda">
                    Registra un nuevo gerente y asígnalo a una cooperativa.
                  </p>

                  <div className="gm-form-grid">
                    {campo('Nombres', 'nombres')}
                    {campo('Apellidos', 'apellidos')}
                    {campo('Correo electrónico', 'correo', 'email')}
                    {campo('Cédula', 'numero_documento')}
                    {campo('Celular', 'telefono')}
                    {campo('Contraseña inicial', 'clave', 'password')}

                    {selectorCooperativa(
                      nuevo.cooperativa_id,
                      (id) => setNuevo((x) => ({
                        ...x,
                        cooperativa_id: id,
                      }))
                    )}
                  </div>
                </div>

                <div className="gm-modal-pie">
                  <button
                    type="button"
                    className="gm-btn"
                    onClick={cerrar}
                    disabled={guardando}
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    className="gm-btn primario"
                    disabled={guardando}
                  >
                    {guardando ? 'Guardando...' : 'Registrar gerente'}
                  </button>
                </div>
              </form>
            )}

            {modal === 'asignar' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault()

                  ejecutarOperacion(
                    () => administracionService.asignarGerenteExistente({
                      usuario_id: usuarioId,
                      cooperativa_id: cooperativaId,
                    }),
                    'Usuario asignado como gerente correctamente.'
                  )
                }}
              >
                <div className="gm-modal-cuerpo">
                  <p className="gm-ayuda">
                    El usuario conservará su cuenta y contraseña actuales.
                  </p>

                  <div className="gm-form-grid">
                    <label className="gm-campo">
                      <span>Usuario</span>
                      <select
                        required
                        value={usuarioId}
                        onChange={(e) => setUsuarioId(e.target.value)}
                      >
                        <option value="">Seleccionar usuario</option>
                        {disponibles.map((u) => (
                          <option key={u.id} value={u.id}>
                            {nombre(u)} — {u.correo}
                          </option>
                        ))}
                      </select>
                    </label>

                    {selectorCooperativa(cooperativaId, setCooperativaId)}
                  </div>
                </div>

                <div className="gm-modal-pie">
                  <button
                    type="button"
                    className="gm-btn"
                    onClick={cerrar}
                    disabled={guardando}
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    className="gm-btn primario"
                    disabled={guardando}
                  >
                    {guardando ? 'Asignando...' : 'Asignar gerente'}
                  </button>
                </div>
              </form>
            )}

            {modal === 'cambiar' && seleccionado && (
              <form
                onSubmit={(e) => {
                  e.preventDefault()

                  ejecutarOperacion(
                    () => administracionService.cambiarCooperativa(
                      seleccionado.usuario_id,
                      cooperativaId
                    ),
                    'Cooperativa actualizada correctamente.'
                  )
                }}
              >
                <div className="gm-modal-cuerpo">
                  <p className="gm-ayuda">
                    Cambiar la cooperativa de{' '}
                    <strong>{nombre(seleccionado.usuarios)}</strong>.
                  </p>

                  {selectorCooperativa(cooperativaId, setCooperativaId)}
                </div>

                <div className="gm-modal-pie">
                  <button
                    type="button"
                    className="gm-btn"
                    onClick={cerrar}
                    disabled={guardando}
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    className="gm-btn primario"
                    disabled={
                      guardando ||
                      cooperativaId === seleccionado.cooperativa_id
                    }
                  >
                    {guardando ? 'Guardando...' : 'Guardar cambio'}
                  </button>
                </div>
              </form>
            )}

            {modal === 'estado' && seleccionado && (
              <>
                <div className="gm-modal-cuerpo">
                  <p>
                    ¿Confirmas que deseas{' '}
                    {seleccionado.activo ? 'desactivar' : 'activar'}{' '}
                    el cargo de gerente de{' '}
                    <strong>{nombre(seleccionado.usuarios)}</strong>?
                  </p>

                  <p className="gm-ayuda">
                    Este cambio afecta únicamente la asignación de gerente.
                    No desactiva ni elimina la cuenta del usuario.
                  </p>
                </div>

                <div className="gm-modal-pie">
                  <button
                    type="button"
                    className="gm-btn"
                    onClick={cerrar}
                    disabled={guardando}
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    className={`gm-btn ${
                      seleccionado.activo ? 'peligro' : 'primario'
                    }`}
                    disabled={guardando}
                    onClick={() =>
                      ejecutarOperacion(
                        () => administracionService.cambiarEstado(
  seleccionado.usuario_id,
  !seleccionado.activo,
  seleccionado.cooperativa_id
),
                        'Estado del gerente actualizado correctamente.'
                      )
                    }
                  >
                    {guardando
                      ? 'Procesando...'
                      : seleccionado.activo
                        ? 'Desactivar cargo'
                        : 'Activar cargo'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}






export default Usuarios
