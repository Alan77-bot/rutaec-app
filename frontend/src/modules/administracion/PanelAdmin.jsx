import { useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { ROLES } from '../../data/usuarios'
import CoopLogo from '../../components/CoopLogo'
import GestionUsuariosGerentes from './GestionUsuariosGerentes'
import {
  obtenerCooperativas,
  cambiarEstadoCooperativa,
  eliminarCooperativa,
} from '../cooperativas/services/cooperativas.service'
import CooperativaRegistroForm from '../cooperativas/CooperativaRegistroForm'
import CooperativaEditarForm from '../cooperativas/CooperativaEditarForm'

const COLORES = ['#f2a33a', '#e4572e', '#2a9d8f', '#4f7cac', '#8a5a9e', '#c0392b']



function Cooperativas() {
  const [cooperativas, setCooperativas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [cooperativaEditar, setCooperativaEditar] = useState(null)
  const [mostrarRegistro, setMostrarRegistro] = useState(false)
  const [cooperativaEliminar, setCooperativaEliminar] = useState(null)
  const [busqueda, setBusqueda] = useState('')
const [filtroEstado, setFiltroEstado] = useState('todas')
const [eliminando, setEliminando] = useState(false)
const [errorEliminar, setErrorEliminar] = useState('')

  const [cooperativaVer, setCooperativaVer] = useState(null)
  const [confirmacionEstado, setConfirmacionEstado] = useState(null)
  const [cambiandoEstado, setCambiandoEstado] = useState(false)

  async function cargarCooperativas() {
    setCargando(true)
    setError('')

    try {
      const datos = await obtenerCooperativas()
      setCooperativas(datos)
    } catch {
      setError('No se pudieron cargar las cooperativas.')
    } finally {
      setCargando(false)
    }
  }

  async function confirmarCambioEstado() {
    if (!confirmacionEstado || cambiandoEstado) return

    const { cooperativa, nuevoEstado } = confirmacionEstado

    setCambiandoEstado(true)
    setError('')

    try {
      await cambiarEstadoCooperativa(cooperativa.id, nuevoEstado)
      setConfirmacionEstado(null)
      await cargarCooperativas()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo cambiar el estado de la cooperativa.'
      )
    } finally {
      setCambiandoEstado(false)
    }
  }

  async function confirmarEliminacion() {
  if (!cooperativaEliminar || eliminando) return

  setEliminando(true)
  setErrorEliminar('')

  try {
    await eliminarCooperativa(cooperativaEliminar.id)
    setCooperativaEliminar(null)
    await cargarCooperativas()
  } catch (err) {
    setErrorEliminar(
      err instanceof Error
        ? err.message
        : 'No se pudo eliminar la cooperativa.'
    )
  } finally {
    setEliminando(false)
  }
}

  useEffect(() => {
    let activo = true

    obtenerCooperativas()
      .then((datos) => {
        if (activo) setCooperativas(datos)
      })
      .catch(() => {
        if (activo) setError('No se pudieron cargar las cooperativas.')
      })
      .finally(() => {
        if (activo) setCargando(false)
      })

    return () => {
      activo = false
    }
  }, [])

  const cooperativasFiltradas = cooperativas.filter((c) => {
  const texto = busqueda.trim().toLowerCase()

  const coincideBusqueda =
    c.nombre_comercial.toLowerCase().includes(texto) ||
    c.razon_social.toLowerCase().includes(texto) ||
    c.ruc.includes(texto)

  const coincideEstado =
    filtroEstado === 'todas' ||
    (filtroEstado === 'activas' && c.activa) ||
    (filtroEstado === 'inactivas' && !c.activa)

  return coincideBusqueda && coincideEstado
})

  return (
    <>

<div className="coops-admin">
  <section className="panel coops-listado">
    <div className="coops-encabezado">
      <div>
        <h3>Cooperativas registradas</h3>
        <p className="muted">
          Administra y consulta las cooperativas de RutaEC.
        </p>
      </div>

      <div className="coops-botones">
        <button
          type="button"
          className="btn btn-claro"
          onClick={cargarCooperativas}
          disabled={cargando}
        >
          {cargando ? 'Cargando...' : '↻ Actualizar'}
        </button>

        <button
          type="button"
          className="btn btn-oscuro"
          onClick={() => setMostrarRegistro(true)}
        >
          + Nueva cooperativa
        </button>
      </div>
    </div>

    {error && (
      <p role="alert" className="coops-error">
        {error}
      </p>
    )}
  <div className="coops-filtros">
  <input
    type="search"
    placeholder="Buscar por nombre, razón social o RUC..."
    value={busqueda}
    onChange={(e) => setBusqueda(e.target.value)}
  />

  <select
    value={filtroEstado}
    onChange={(e) => setFiltroEstado(e.target.value)}
  >
    <option value="todas">Todas las cooperativas</option>
    <option value="activas">Activas</option>
    <option value="inactivas">Inactivas</option>
  </select>
</div>
    <div className="tabla-wrap">
      <table className="tabla coops-tabla">
        <thead>
          <tr>
            <th>Cooperativa</th>
            <th>Razón social</th>
            <th>RUC</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>

        <tbody>
          {cooperativasFiltradas.map((c) => (
            <tr key={c.id} className={c.activa ? '' : 'inactiva'}>
              <td><b>{c.nombre_comercial}</b></td>
              <td>{c.razon_social}</td>
              <td>{c.ruc}</td>
              <td>
                <span className={'badge ' + (c.activa ? 'verde' : 'gris')}>
                  {c.activa ? 'Activa' : 'Inactiva'}
                </span>
              </td>
              <td>
                <div className="coops-acciones">
                  <button
                    type="button"
                    className="btn-link"
                    onClick={() => setCooperativaVer(c)}
                  >
                    Ver
                  </button>

                  <button
                    type="button"
                    className="btn-link"
                    onClick={() => setCooperativaEditar(c)}
                  >
                    Editar
                  </button>

                  <button
                    type="button"
                    className="btn-link"
                    onClick={() =>
                      setConfirmacionEstado({
                        cooperativa: c,
                        nuevoEstado: !c.activa,
                      })
                    }
                  >
                    {c.activa ? 'Desactivar' : 'Activar'}
                  </button>

                  <button
                    type="button"
                    className="btn-link"
                    style={{ color: '#c0392b' }}
                    onClick={() => {
                      setErrorEliminar('')
                      setCooperativaEliminar(c)
                    }}
                  >
                    Eliminar
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {!cargando && !error && cooperativas.length === 0 && (
        <div className="vacio">
          <b>No hay cooperativas registradas.</b>
        </div>
      )}

      {cargando && (
        <p className="muted">Cargando cooperativas...</p>
      )}
    </div>
  </section>
</div>

{/* MODAL DE REGISTRO */}
{mostrarRegistro && (
  <div className="modal-overlay">
    <section
      className="modal-contenido modal-cooperativa"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-registro-coop"
    >
      <button
        type="button"
        className="modal-x"
        onClick={() => setMostrarRegistro(false)}
        aria-label="Cerrar"
      >
        ×
      </button>

      <h2 id="titulo-registro-coop">Nueva cooperativa</h2>

      <CooperativaRegistroForm
        onRegistrada={async () => {
          await cargarCooperativas()
          setMostrarRegistro(false)
        }}
      />
    </section>
  </div>
)}

{/* MODAL DE EDICIÓN */}
{cooperativaEditar && (
  <div className="modal-overlay">
    <section
      className="modal-contenido modal-cooperativa"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-edicion-coop"
    >
      <button
        type="button"
        className="modal-x"
        onClick={() => setCooperativaEditar(null)}
        aria-label="Cerrar"
      >
        ×
      </button>

      <h2 id="titulo-edicion-coop">Editar cooperativa</h2>

      <CooperativaEditarForm
        cooperativa={cooperativaEditar}
        onCancelar={() => setCooperativaEditar(null)}
        onActualizada={async () => {
          await cargarCooperativas()
          setCooperativaEditar(null)
        }}
      />
    </section>
  </div>
)}


      {cooperativaVer && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setCooperativaVer(null)
          }}
        >
          <section
            className="modal-contenido modal-cooperativa"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-detalles-coop"
          >
            <header className="modal-header">
              <div>
                <span className="modal-etiqueta">INFORMACIÓN GENERAL</span>
                <h2 id="titulo-detalles-coop">Detalle de cooperativa</h2>
              </div>

              <button
                type="button"
                className="modal-cerrar"
                onClick={() => setCooperativaVer(null)}
                aria-label="Cerrar"
              >
                ×
              </button>
            </header>

            <div className="modal-identidad">
              <div className="modal-icono">
                <div className="modal-icono">
    BUS
  </div>
              </div>
              <div>
                <h3>{cooperativaVer.nombre_comercial}</h3>
                <span className={'badge ' + (cooperativaVer.activa ? 'verde' : 'gris')}>
                  {cooperativaVer.activa ? 'Activa' : 'Inactiva'}
                </span>
              </div>
            </div>

            <div className="modal-seccion">
              <h4>Datos de la cooperativa</h4>

              <div className="detalle-grid">
                <div className="detalle-item">
                  <span>RUC</span>
                  <strong>{cooperativaVer.ruc || 'No registrado'}</strong>
                </div>

                <div className="detalle-item">
                  <span>Razón social</span>
                  <strong>{cooperativaVer.razon_social || 'No registrada'}</strong>
                </div>

                <div className="detalle-item">
                  <span>Nombre comercial</span>
                  <strong>{cooperativaVer.nombre_comercial || 'No registrado'}</strong>
                </div>
              </div>
            </div>

            <div className="modal-seccion">
              <h4>Información de contacto</h4>

              <div className="detalle-grid">
                <div className="detalle-item">
                  <span>Correo electrónico</span>
                  <strong>{cooperativaVer.correo || 'No registrado'}</strong>
                </div>

                <div className="detalle-item">
                  <span>Teléfono</span>
                  <strong>{cooperativaVer.telefono || 'No registrado'}</strong>
                </div>

                <div className="detalle-item">
                  <span>Dirección</span>
                  <strong>{cooperativaVer.direccion || 'No registrada'}</strong>
                </div>

                <div className="detalle-item">
                  <span>Sitio web</span>
                  {cooperativaVer.sitio_web ? (
                    <a href={cooperativaVer.sitio_web} target="_blank" rel="noreferrer">
                      {cooperativaVer.sitio_web}
                    </a>
                  ) : (
                    <strong>No registrado</strong>
                  )}
                </div>
              </div>
            </div>

            <footer className="modal-footer">
              <button
                type="button"
                className="btn btn-oscuro"
                onClick={() => {
                  setCooperativaVer(null)
                  setCooperativaEditar(cooperativaVer)
                }}
              >
                Editar cooperativa
              </button>

              <button
                type="button"
                className="btn btn-claro"
                onClick={() => setCooperativaVer(null)}
              >
                Cerrar
              </button>
            </footer>
          </section>
        </div>
      )}

      {confirmacionEstado && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !cambiandoEstado) {
              setConfirmacionEstado(null)
            }
          }}
        >
          <section
            className="modal-contenido modal-confirmacion"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="titulo-confirmacion-coop"
          >
            <div className="modal-alerta-icono">
              {confirmacionEstado.nuevoEstado ? '✓' : '!'}
            </div>

            <h2 id="titulo-confirmacion-coop">
              {confirmacionEstado.nuevoEstado
                ? 'Activar cooperativa'
                : 'Desactivar cooperativa'}
            </h2>

            <p>
              ¿Deseas {confirmacionEstado.nuevoEstado ? 'activar' : 'desactivar'}
              la cooperativa <strong>{confirmacionEstado.cooperativa.nombre_comercial}</strong>?
            </p>

            <footer className="modal-footer">
              <button
                type="button"
                className="btn btn-claro"
                disabled={cambiandoEstado}
                onClick={() => setConfirmacionEstado(null)}
              >
                Cancelar
              </button>

              <button
                type="button"
                className={confirmacionEstado.nuevoEstado ? 'btn btn-oscuro' : 'btn btn-danger'}
                disabled={cambiandoEstado}
                onClick={confirmarCambioEstado}
              >
                {cambiandoEstado
                  ? 'Procesando...'
                  : confirmacionEstado.nuevoEstado
                    ? 'Sí, activar'
                    : 'Sí, desactivar'}
              </button>
            </footer>
          </section>
        </div>
      )}
      {/* MODAL PARA ELIMINAR COOPERATIVA */}
{cooperativaEliminar && (
  <div className="modal-overlay">
    <section
      className="modal-contenido modal-cooperativa"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="titulo-eliminar-coop"
      aria-describedby="descripcion-eliminar-coop"
    >
      <button
        type="button"
        className="modal-x"
        onClick={() => setCooperativaEliminar(null)}
        disabled={eliminando}
        aria-label="Cerrar"
      >
        ×
      </button>

      <h2 id="titulo-eliminar-coop">
        Eliminar cooperativa
      </h2>

      <p id="descripcion-eliminar-coop">
        ¿Estás seguro de que deseas eliminar
        <strong> {cooperativaEliminar.nombre_comercial}</strong>?
      </p>

      <p className="muted">
        Esta acción es permanente y no se puede deshacer.
        Si tiene registros asociados, el sistema impedirá eliminarla.
      </p>

      {errorEliminar && (
        <p role="alert" className="coops-error">
          {errorEliminar}
        </p>
      )}

      <div className="form-fila">
        <button
          type="button"
          className="btn btn-claro"
          disabled={eliminando}
          onClick={() => setCooperativaEliminar(null)}
        >
          Cancelar
        </button>

        <button
          type="button"
          className="btn btn-oscuro"
          style={{ background: '#c0392b', borderColor: '#c0392b' }}
          disabled={eliminando}
          onClick={confirmarEliminacion}
        >
          {eliminando ? 'Eliminando...' : 'Eliminar definitivamente'}
        </button>
      </div>
    </section>
  </div>
)}
    </>
  )
}





function Configuracion() {
  const { config, acciones, ejecutar, avisar } = useApp()
  // Se edita una copia y solo se aplica a toda la app cuando se guarda.
  const [form, setForm] = useState(config)
  const [guardando, setGuardando] = useState(false)

  const subirLogo = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 500 * 1024) return avisar('El logo debe pesar menos de 500 KB.')
    const lector = new FileReader()
    lector.onload = () => setForm((x) => ({ ...x, logo: lector.result }))
    lector.readAsDataURL(file)
  }
  const redes = (k, v) => setForm({ ...form, redes: { ...form.redes, [k]: v } })
  const guardar = async () => {
    setGuardando(true)
    await ejecutar(() => acciones.guardarAjustes(form), 'Configuración guardada.')
    setGuardando(false)
  }

  return (
    <div className="dos-col">
      <div className="panel config">
        <h4>Identidad</h4>
        <label>Nombre de la aplicación<input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></label>
        <label>Logo
          <input type="file" accept="image/*" onChange={subirLogo} />
        </label>
        <div>
          <span className="lbl">Color de acento</span>
          <div className="swatches">
            {COLORES.map((c) => (
              <button key={c} style={{ background: c }} className={form.color === c ? 'on' : ''} onClick={() => setForm({ ...form, color: c })} aria-label={c} />
            ))}
          </div>
        </div>
        <h4>Soporte y redes</h4>
        <label>Teléfono<input value={form.soporteTel} onChange={(e) => setForm({ ...form, soporteTel: e.target.value })} /></label>
        <label>Correo<input value={form.soporteMail} onChange={(e) => setForm({ ...form, soporteMail: e.target.value })} /></label>
        <label>Instagram<input value={form.redes.instagram} onChange={(e) => redes('instagram', e.target.value)} /></label>
        <label>Facebook<input value={form.redes.facebook} onChange={(e) => redes('facebook', e.target.value)} /></label>
        <label>WhatsApp<input value={form.redes.whatsapp} onChange={(e) => redes('whatsapp', e.target.value)} /></label>
        <button className="btn btn-oscuro" onClick={guardar} disabled={guardando}>{guardando ? 'Guardandoâ€¦' : 'Guardar'}</button>
      </div>
      <div className="panel previa">
        <h4>Vista previa</h4>
        <div className="previa-nav">
          {form.logo ? <img src={form.logo} alt="" /> : <span className="marca-logo-app" />}
          <b>{form.nombre}</b>
          <span className="btn" style={{ background: form.color, color: '#2a1c05' }}>Ingresar</span>
        </div>
        <p className="muted">Al guardar, los cambios se aplican a toda la aplicación.</p>
      </div>
      
    </div>
  )
}

function Usuarios() {
  const { usuarios, acciones, ejecutar, cooperativas, sesion } = useApp()
  const [f, setF] = useState({ nombre: '', correo: '', clave: '', rol: 'oficinista', coopId: 'amazonas' })

  useEffect(() => {
    acciones.cargarUsuarios().catch(() => {})
  }, [acciones])

  const crear = async (e) => {
    e.preventDefault()
    const r = await ejecutar(() => acciones.crearUsuario({ ...f, coopId: f.rol === 'admin' ? null : f.coopId }), 'Usuario creado.')
    if (r.ok) setF({ ...f, nombre: '', correo: '', clave: '' })
  }
  const quitar = (u) => ejecutar(() => acciones.borrarUsuario(u.id), 'Usuario eliminado.')

  return (
    <div className="dos-col">
      <div className="tabla-wrap">
        <table className="tabla">
          <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Cooperativa</th><th /></tr></thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td><b>{u.nombre}</b></td>
                <td>{u.correo}</td>
                <td><span className="badge gris">{ROLES[u.rol]}</span></td>
                <td>{cooperativas.find((c) => c.id === u.coopId)?.nombre || 'â€”'}</td>
                <td>{u.id !== sesion.id && <button className="btn-link rojo" onClick={() => quitar(u)}>Eliminar</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form className="panel" onSubmit={crear}>
        <h4>Nuevo usuario</h4>
        <label>Nombre<input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></label>
        <label>Correo<input value={f.correo} onChange={(e) => setF({ ...f, correo: e.target.value })} /></label>
        <label>Contraseña inicial<input type="password" value={f.clave} onChange={(e) => setF({ ...f, clave: e.target.value })} /></label>
        <label>Rol
          <select value={f.rol} onChange={(e) => setF({ ...f, rol: e.target.value })}>
            <option value="oficinista">Oficinista</option>
            <option value="cooperativa">Cooperativa</option>
            <option value="admin">Administrador</option>
          </select>
        </label>
        {(f.rol === 'oficinista' || f.rol === 'cooperativa') && (
          <label>Cooperativa
            <select value={f.coopId} onChange={(e) => setF({ ...f, coopId: e.target.value })}>
              {cooperativas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </label>
        )}
        <button className="btn btn-oscuro">Crear usuario</button>
      </form>
    </div>
  )
}

export default function PanelAdmin() {
  const [tab, setTab] = useState('coops')
  return (
    <div className="contenedor">
      <div className="seccion-cab izq">
        <h1>Administración</h1>
        <p>Cooperativas, usuarios y apariencia de la aplicación.</p>
      </div>
      <div className="tabs">
        <button className={tab === 'coops' ? 'on' : ''} onClick={() => setTab('coops')}>Cooperativas</button>
        <button className={tab === 'users' ? 'on' : ''} onClick={() => setTab('users')}>Usuarios</button>
        <button className={tab === 'config' ? 'on' : ''} onClick={() => setTab('config')}>Configuración</button>
      </div>
      {tab === 'coops' && <Cooperativas />}
      {tab === 'users' && <GestionUsuariosGerentes />}
      {tab === 'config' && <Configuracion />}
    </div>
  )
}
