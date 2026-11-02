import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { perfilService } from './services/perfil.service'

const CLAVES_VACIAS = { claveActual: '', nuevaClave: '', confirmarClave: '' }

export default function Perfil() {
  const { sesion, setSesion, reintentar, avisar } = useApp()
  const nav = useNavigate()
  const [perfil, setPerfil] = useState(null)
  const [datos, setDatos] = useState({ nombres: '', apellidos: '', telefono: '' })
  const [claves, setClaves] = useState(CLAVES_VACIAS)
  const [correo, setCorreo] = useState('')
  const [claveCorreo, setClaveCorreo] = useState('')
  const [pendiente, setPendiente] = useState(null)
  const [codigo, setCodigo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let vigente = true
    perfilService.consultar().then(({ perfil: p }) => {
      if (!vigente) return
      setPerfil(p)
      setDatos({ nombres: p.nombres, apellidos: p.apellidos, telefono: p.telefono })
      setError('')
    }).catch(e => { if (vigente) setError(e.message) })
    return () => { vigente = false }
  }, [intento])

  async function operar(evento, accion) {
    evento.preventDefault()
    if (ocupado) return
    setOcupado(true)
    setError('')
    setMensaje('')
    try { await accion() }
    catch (e) { setError(e.message ?? 'No se pudo completar la operación.') }
    finally { setOcupado(false) }
  }

  async function volverAIngresar(texto) {
    setClaves(CLAVES_VACIAS)
    setClaveCorreo('')
    setCodigo('')
    setSesion(null)
    await reintentar()
    avisar(texto)
    nav('/ingresar', { replace: true })
  }

  const guardarDatos = evento => operar(evento, async () => {
    const { perfil: p } = await perfilService.actualizar(datos)
    setPerfil(p)
    setDatos({ nombres: p.nombres, apellidos: p.apellidos, telefono: p.telefono })
    setSesion(actual => actual ? { ...actual, nombre: `${p.nombres} ${p.apellidos}`.trim() } : actual)
    setMensaje('Tus datos fueron guardados.')
  })
  const guardarClave = evento => operar(evento, async () => {
    if (claves.nuevaClave.length < 8 || new TextEncoder().encode(claves.nuevaClave).length > 72) throw new Error('La contraseña debe tener al menos 8 caracteres y hasta 72 bytes.')
    if (claves.nuevaClave !== claves.confirmarClave) throw new Error('Las contraseñas no coinciden.')
    const resultado = await perfilService.cambiarClave(claves)
    await volverAIngresar(resultado.mensaje)
  })
  const pedirCorreo = evento => operar(evento, async () => {
    const resultado = await perfilService.solicitarCorreo(correo, claveCorreo)
    setPendiente({ ...resultado, correo: correo.trim().toLowerCase() })
    setClaveCorreo('')
    setCodigo('')
    setMensaje(resultado.mensaje)
  })
  const confirmarCorreo = evento => operar(evento, async () => {
    const resultado = await perfilService.confirmarCorreo(pendiente.verificacionId, codigo)
    await volverAIngresar(resultado.mensaje)
  })

  if (!perfil) return (
    <div className="contenedor panel">
      {error ? <><p role="alert">{error}</p><button className="btn btn-oscuro" onClick={() => { setError(''); setIntento(i => i + 1) }}>Reintentar</button></> : <p role="status">Cargando tu perfil…</p>}
    </div>
  )

  return (
    <div className="contenedor">
      <h1>Mi perfil</h1>
      <p>{perfil.correo}</p>
      {error && <p className="auth-aviso" role="alert">{error}</p>}
      {mensaje && <p className="auth-aviso" role="status">{mensaje}</p>}
      <div className="dos-col">
        <section className="panel">
          <h2>Mis datos</h2>
          <p className="muted">Documento: {perfil.tipo_documento} · {perfil.pais_documento} · {perfil.numero_documento}</p>
          <p className="muted">Los datos del documento no se modifican desde el perfil. Si necesitas corregirlos, solicita revisión al administrador.</p>
          <form className="auth-campos" onSubmit={guardarDatos}>
            <label>Nombres<input autoComplete="given-name" required maxLength={100} value={datos.nombres} disabled={ocupado} onChange={e => setDatos({ ...datos, nombres: e.target.value })} /></label>
            <label>Apellidos<input autoComplete="family-name" required maxLength={100} value={datos.apellidos} disabled={ocupado} onChange={e => setDatos({ ...datos, apellidos: e.target.value })} /></label>
            <label>Celular<input type="tel" autoComplete="tel" required pattern="09[0-9]{8}" maxLength={10} value={datos.telefono} disabled={ocupado} onChange={e => setDatos({ ...datos, telefono: e.target.value })} /><small>10 dígitos, comienza con 09.</small></label>
            <button className="btn btn-oscuro" disabled={ocupado}>{ocupado ? 'Procesando…' : 'Guardar datos'}</button>
          </form>
        </section>
        <section className="panel">
          <h2>Cambiar contraseña</h2>
          <p className="muted">Mínimo 8 caracteres y máximo 72 bytes. Se cerrarán todas tus sesiones al guardar.</p>
          <form className="auth-campos" onSubmit={guardarClave}>
            <label>Contraseña actual<input type="password" autoComplete="current-password" required value={claves.claveActual} disabled={ocupado} onChange={e => setClaves({ ...claves, claveActual: e.target.value })} /></label>
            <label>Nueva contraseña<input type="password" autoComplete="new-password" minLength={8} required value={claves.nuevaClave} disabled={ocupado} onChange={e => setClaves({ ...claves, nuevaClave: e.target.value })} /></label>
            <label>Confirmar nueva contraseña<input type="password" autoComplete="new-password" minLength={8} required value={claves.confirmarClave} disabled={ocupado} onChange={e => setClaves({ ...claves, confirmarClave: e.target.value })} /></label>
            <button className="btn btn-oscuro" disabled={ocupado}>Guardar contraseña</button>
          </form>
        </section>
      </div>
      <section className="panel">
        <h2>Cambiar correo</h2>
        <p className="muted">Enviaremos un código al nuevo correo. El anterior seguirá activo hasta confirmar. Puedes solicitar otro código después de un minuto; el anterior se invalida.</p>
        <form className="auth-campos" onSubmit={pedirCorreo}>
          <label>Nuevo correo<input type="email" autoComplete="email" maxLength={254} required value={correo} disabled={ocupado} onChange={e => setCorreo(e.target.value)} /></label>
          <label>Contraseña actual<input type="password" autoComplete="current-password" required value={claveCorreo} disabled={ocupado} onChange={e => setClaveCorreo(e.target.value)} /></label>
          <button className="btn btn-oscuro" disabled={ocupado}>Enviar código</button>
        </form>
        {pendiente && <form className="auth-campos" onSubmit={confirmarCorreo}>
          <p>Código enviado a {pendiente.correo}. Vence a las {new Date(pendiente.venceEn).toLocaleTimeString('es-EC')}. Al confirmar se cerrarán tus sesiones.</p>
          <label>Código de seis dígitos<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={codigo} disabled={ocupado} onChange={e => setCodigo(e.target.value)} /></label>
          <button className="btn btn-oscuro" disabled={ocupado}>Confirmar nuevo correo</button>
        </form>}
      </section>
      <p className="muted">Cuenta: {sesion?.nombre}. Los roles y la cooperativa se gestionan por el personal autorizado.</p>
    </div>
  )
}
