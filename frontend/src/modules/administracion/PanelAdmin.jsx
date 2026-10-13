import { useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { ROLES } from '../../data/usuarios'
import CoopLogo from '../../components/CoopLogo'
import { obtenerCooperativas } from '../cooperativas/services/cooperativas.service'
import CooperativaRegistroForm from '../cooperativas/CooperativaRegistroForm'
import CooperativaEditarForm from '../cooperativas/CooperativaEditarForm'

const COLORES = ['#f2a33a', '#e4572e', '#2a9d8f', '#4f7cac', '#8a5a9e', '#c0392b']


function Cooperativas() {
  const [cooperativas, setCooperativas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [cooperativaEditar, setCooperativaEditar] = useState(null)

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

  return (
    <div className="dos-col">
    <div className="panel">
      <div className="seccion-cab izq">
        <h3>Cooperativas registradas</h3>
        <button
          type="button"
          className="btn btn-oscuro"
          onClick={cargarCooperativas}
          disabled={cargando}
        >
          {cargando ? 'Cargando...' : 'Actualizar listado'}
        </button>
      </div>

      {error && (
        <p role="alert" className="muted">
          {error}
        </p>
      )}

      <div className="tabla-wrap">
        <table className="tabla">
          <thead>
            <tr>
              <th>Cooperativa</th>
              <th>Razón social</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {cooperativas.map((c) => (
              <tr key={c.id} className={c.activa ? '' : 'inactiva'}>
                <td><b>{c.nombre_comercial}</b></td>
                <td>{c.razon_social}</td>
                <td>
                  <span className={'badge ' + (c.activa ? 'verde' : 'gris')}>
                    {c.activa ? 'Activa' : 'Inactiva'}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
                    className="btn-link"
                    onClick={() => setCooperativaEditar(c)}
                  >
                    Editar
                  </button>
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

        {cargando && <p className="muted">Cargando cooperativas...</p>}
      </div>
    </div>
      {cooperativaEditar ? (
      <CooperativaEditarForm
        cooperativa={cooperativaEditar}
        onCancelar={() => setCooperativaEditar(null)}
      />
    ) : (
      <CooperativaRegistroForm />
    )}
    </div>
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
    await ejecutar(() => acciones.guardarAjustes(form), 'ConfiguraciÃ³n guardada.')
    setGuardando(false)
  }

  return (
    <div className="dos-col">
      <div className="panel config">
        <h4>Identidad</h4>
        <label>Nombre de la aplicaciÃ³n<input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></label>
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
        <label>TelÃ©fono<input value={form.soporteTel} onChange={(e) => setForm({ ...form, soporteTel: e.target.value })} /></label>
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
        <p className="muted">Al guardar, los cambios se aplican a toda la aplicaciÃ³n.</p>
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
        <label>ContraseÃ±a inicial<input type="password" value={f.clave} onChange={(e) => setF({ ...f, clave: e.target.value })} /></label>
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
        <h1>AdministraciÃ³n</h1>
        <p>Cooperativas, usuarios y apariencia de la aplicaciÃ³n.</p>
      </div>
      <div className="tabs">
        <button className={tab === 'coops' ? 'on' : ''} onClick={() => setTab('coops')}>Cooperativas</button>
        <button className={tab === 'users' ? 'on' : ''} onClick={() => setTab('users')}>Usuarios</button>
        <button className={tab === 'config' ? 'on' : ''} onClick={() => setTab('config')}>ConfiguraciÃ³n</button>
      </div>
      {tab === 'coops' && <Cooperativas />}
      {tab === 'users' && <Usuarios />}
      {tab === 'config' && <Configuracion />}
    </div>
  )
}

