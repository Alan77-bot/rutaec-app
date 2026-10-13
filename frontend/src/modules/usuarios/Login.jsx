import { useEffect, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../../services/viajayaApi'
import { useApp } from '../../context/AppContext'
import Icon from '../../components/Icon'
import { CuerpoCorreo } from '../../components/VisorCorreo'
import { RUTA_POR_ROL, ROLES, USUARIOS_INICIALES } from '../../data/usuarios'

const emailOk = (v) => /^\S+@\S+\.\S+$/.test(v)

export default function Login() {
  const { sesion, iniciarSesion, entrarConRespuesta, avisar, config } = useApp()
  const nav = useNavigate()
  const loc = useLocation()
  const destino = loc.state?.from

  const [modo, setModo] = useState('entrar')
  const [f, setF] = useState({ nombre: '', correo: '', clave: '', repetir: '' })
  const [ver, setVer] = useState(false)
  const [err, setErr] = useState({})
  const [sacudir, setSacudir] = useState(0)
  const [cuentas, setCuentas] = useState(false)
  const [enviando, setEnviando] = useState(false)

  // verificaciÃ³n del correo: lo que devolviÃ³ el servidor al registrar
  const [pend, setPend] = useState(null)
  const [digitos, setDigitos] = useState(['', '', '', '', '', ''])
  const [errCodigo, setErrCodigo] = useState('')
  const [ahora, setAhora] = useState(Date.now())
  const celdas = useRef([])

  useEffect(() => {
    if (!pend) return
    const t = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(t)
  }, [pend])

  if (sesion) return <Navigate to={destino || RUTA_POR_ROL[sesion.rol]} replace />

  const poner = (k, v) => {
    setF({ ...f, [k]: v })
    if (err[k]) setErr({ ...err, [k]: null })
  }
  const fallar = (e) => {
    setErr(e)
    setSacudir((s) => s + 1)
  }

  const entrar = async (e) => {
    e.preventDefault()
    const nuevo = {}
    if (!f.correo.trim()) nuevo.correo = 'Escribe tu correo.'
    else if (!emailOk(f.correo)) nuevo.correo = 'El correo no tiene un formato vÃ¡lido.'
    if (!f.clave) nuevo.clave = 'Escribe tu contraseÃ±a.'
    if (Object.keys(nuevo).length) return fallar(nuevo)

    setEnviando(true)
    const r = await iniciarSesion(f.correo, f.clave)
    setEnviando(false)
    if (!r.ok) return fallar({ [r.campo]: r.error })
    avisar(`Bienvenido, ${r.sesion.nombre.split(' ')[0]}`)
    nav(destino && ['usuario', 'oficinista'].includes(r.sesion.rol) ? destino : RUTA_POR_ROL[r.sesion.rol], { replace: true })
  }

  const registrar = async (e) => {
    e.preventDefault()
    const nuevo = {}
    if (f.nombre.trim().length < 3) nuevo.nombre = 'Escribe tu nombre completo.'
    if (!emailOk(f.correo)) nuevo.correo = 'El correo no tiene un formato vÃ¡lido.'
    if (f.clave.length < 8) nuevo.clave = 'MÃ­nimo 8 caracteres.'
    else if (!/\d/.test(f.clave) || !/[A-Za-z]/.test(f.clave)) nuevo.clave = 'Combina letras y nÃºmeros.'
    if (f.repetir !== f.clave) nuevo.repetir = 'Las contraseÃ±as no coinciden.'
    if (Object.keys(nuevo).length) return fallar(nuevo)

    setEnviando(true)
    try {
      const r = await api.post('/auth/registro', { nombre: f.nombre.trim(), correo: f.correo.trim(), clave: f.clave })
      setPend({ nombre: f.nombre.trim(), correo: f.correo.trim().toLowerCase(), ...r })
      setDigitos(['', '', '', '', '', ''])
      setErrCodigo('')
      setAhora(Date.now())
      setTimeout(() => celdas.current[0]?.focus(), 60)
    } catch (e2) {
      fallar({ [e2.campo || 'correo']: e2.message })
    }
    setEnviando(false)
  }

  const cambiarDigito = (i, v) => {
    const limpio = v.replace(/\D/g, '')
    if (!limpio) {
      setDigitos((d) => d.map((x, k) => (k === i ? '' : x)))
      return
    }
    if (limpio.length > 1) {
      // pegaron el cÃ³digo completo
      const arr = limpio.slice(0, 6).split('')
      setDigitos(['', '', '', '', '', ''].map((_, k) => arr[k] || ''))
      celdas.current[Math.min(arr.length, 5)]?.focus()
      return
    }
    setDigitos((d) => d.map((x, k) => (k === i ? limpio : x)))
    if (i < 5) celdas.current[i + 1]?.focus()
  }
  const teclaDigito = (i, e) => {
    if (e.key === 'Backspace' && !digitos[i] && i > 0) celdas.current[i - 1]?.focus()
  }

  const verificar = async (e) => {
    e.preventDefault()
    const escrito = digitos.join('')
    if (escrito.length < 6) {
      setErrCodigo('Escribe los 6 dÃ­gitos del cÃ³digo.')
      return setSacudir((s) => s + 1)
    }
    setEnviando(true)
    try {
      const r = await api.post('/auth/verificar', { correo: pend.correo, codigo: escrito })
      await entrarConRespuesta(r)
      avisar('Correo verificado. Â¡Tu cuenta estÃ¡ lista!')
      nav(destino || '/', { replace: true })
    } catch (e2) {
      setErrCodigo(e2.message)
      setSacudir((s) => s + 1)
    }
    setEnviando(false)
  }

  const reenviar = async () => {
    if (Date.now() < pend.reenvioEn) return
    try {
      const r = await api.post('/auth/reenviar', { correo: pend.correo })
      setPend({ ...pend, ...r })
      setDigitos(['', '', '', '', '', ''])
      setErrCodigo('')
      setAhora(Date.now())
      avisar('Te enviamos un cÃ³digo nuevo.')
      celdas.current[0]?.focus()
    } catch (e2) {
      avisar(e2.message)
    }
  }

  const cambiarModo = (m) => {
    setModo(m)
    setErr({})
    setPend(null)
  }

  const usarCuenta = (u) => {
    setModo('entrar')
    setErr({})
    setPend(null)
    setF({ ...f, correo: u.correo, clave: u.clave })
  }

  const ojo = (
    <button type="button" className="ojo" onClick={() => setVer(!ver)} aria-label="Mostrar u ocultar contraseÃ±a">
      <Icon n={ver ? 'eyeoff' : 'eye'} size={18} />
    </button>
  )

  const segundosVida = pend ? Math.max(0, Math.ceil((pend.expira - ahora) / 1000)) : 0
  const segundosReenvio = pend ? Math.max(0, Math.ceil((pend.reenvioEn - ahora) / 1000)) : 0

  return (
    <div className="auth">
      <aside className="auth-lado" style={{ backgroundImage: 'url(/img/bus-azul.jpg)' }}>
        <div className="auth-velo" />
        <div className="auth-lado-in">
          <p className="etiqueta">{config.nombre}</p>
          <h2>Tu prÃ³ximo viaje empieza aquÃ­.</h2>
          <p>Compra pasajes de las cooperativas interprovinciales, elige tu asiento y lleva el boleto en el celular.</p>
          <ul className="auth-lista">
            <li><Icon n="shield" />Cuentas verificadas por correo</li>
            <li><Icon n="qr" />Boleto con cÃ³digo QR en tu cuenta</li>
            <li><Icon n="mail" />Avisos por correo en cada paso</li>
          </ul>
        </div>
      </aside>

      <section className="auth-form">
        <div className={'auth-card' + (sacudir ? ' sacudida' : '')} key={sacudir}>
          {pend ? (
            <form onSubmit={verificar} noValidate className="auth-campos verif">
              <span className="verif-ico"><Icon n="mail" size={26} /></span>
              <h3>Revisa tu correo</h3>
              <p className="muted">
                Enviamos un cÃ³digo de 6 dÃ­gitos a <b>{pend.correo}</b>.
                {pend.correoReal ? ' BÃºscalo en tu bandeja de entrada (y en spam).' : ' EscrÃ­belo para confirmar que el correo es tuyo.'}
              </p>

              <div className="codigo-celdas">
                {digitos.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => (celdas.current[i] = el)}
                    value={d}
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="one-time-code"
                    aria-label={`DÃ­gito ${i + 1}`}
                    onChange={(e) => cambiarDigito(i, e.target.value)}
                    onKeyDown={(e) => teclaDigito(i, e)}
                    className={errCodigo ? 'mal' : ''}
                  />
                ))}
              </div>
              {errCodigo && <small className="err-codigo">{errCodigo}</small>}
              <p className={'vigencia' + (segundosVida === 0 ? ' venc' : '')}>
                {segundosVida > 0 ? `El cÃ³digo vence en ${String(Math.floor(segundosVida / 60)).padStart(2, '0')}:${String(segundosVida % 60).padStart(2, '0')}` : 'El cÃ³digo venciÃ³'}
              </p>

              <button className="btn btn-oscuro btn-lg ancho" disabled={enviando}>{enviando ? 'Verificandoâ€¦' : 'Verificar e ingresar'} <Icon n="arrow" size={18} /></button>
              <div className="verif-links">
                <button type="button" className="btn-link" onClick={reenviar} disabled={segundosReenvio > 0}>
                  {segundosReenvio > 0 ? `Reenviar cÃ³digo en ${segundosReenvio}s` : 'Reenviar cÃ³digo'}
                </button>
                <button type="button" className="btn-link" onClick={() => setPend(null)}>Cambiar correo</button>
              </div>

              {pend.demo && (
                <div className="bandeja-demo">
                  <p className="bandeja-tit"><Icon n="mail" size={14} /> Bandeja de demostraciÃ³n</p>
                  <small>El servidor no tiene Gmail configurado, asÃ­ que el correo se muestra aquÃ­.</small>
                  <div className="bandeja-correo">
                    <b>{pend.demo.asunto}</b>
                    <span>De: {config.nombre} Â· Para: {pend.demo.para}</span>
                    <CuerpoCorreo cuerpo={pend.demo.cuerpo} />
                  </div>
                </div>
              )}
            </form>
          ) : (
            <>
              <div className="auth-tabs">
                <button className={modo === 'entrar' ? 'on' : ''} onClick={() => cambiarModo('entrar')}>Ingresar</button>
                <button className={modo === 'registro' ? 'on' : ''} onClick={() => cambiarModo('registro')}>Crear cuenta</button>
                <i style={{ transform: `translateX(${modo === 'entrar' ? 0 : 100}%)` }} />
              </div>

              {destino && <p className="auth-aviso">Inicia sesiÃ³n para continuar con tu compra.</p>}

              {modo === 'entrar' ? (
                <form onSubmit={entrar} noValidate className="auth-campos">
                  <Campo icono="mail" etiqueta="Correo electrÃ³nico" error={err.correo}>
                    <input type="email" autoComplete="username" placeholder="tucorreo@ejemplo.com" value={f.correo} onChange={(e) => poner('correo', e.target.value)} />
                  </Campo>
                  <Campo icono="lock" etiqueta="ContraseÃ±a" error={err.clave} extra={ojo}>
                    <input type={ver ? 'text' : 'password'} autoComplete="current-password" placeholder="Tu contraseÃ±a" value={f.clave} onChange={(e) => poner('clave', e.target.value)} />
                  </Campo>
                  <button type="button" className="btn-link olvido" onClick={() => avisar('La recuperaciÃ³n de contraseÃ±a llegarÃ¡ en la siguiente versiÃ³n.')}>Â¿Olvidaste tu contraseÃ±a?</button>
                  <button className="btn btn-oscuro btn-lg ancho" disabled={enviando}>{enviando ? 'Ingresandoâ€¦' : 'Ingresar'} <Icon n="arrow" size={18} /></button>
                </form>
              ) : (
                <form onSubmit={registrar} noValidate className="auth-campos">
                  <Campo icono="user" etiqueta="Nombre completo" error={err.nombre}>
                    <input autoComplete="name" value={f.nombre} onChange={(e) => poner('nombre', e.target.value)} />
                  </Campo>
                  <Campo icono="mail" etiqueta="Correo electrÃ³nico" error={err.correo}>
                    <input type="email" autoComplete="email" value={f.correo} onChange={(e) => poner('correo', e.target.value)} />
                  </Campo>
                  <Campo icono="lock" etiqueta="ContraseÃ±a" error={err.clave} extra={ojo}>
                    <input type={ver ? 'text' : 'password'} autoComplete="new-password" value={f.clave} onChange={(e) => poner('clave', e.target.value)} />
                  </Campo>
                  <Campo icono="lock" etiqueta="Repite la contraseÃ±a" error={err.repetir}>
                    <input type={ver ? 'text' : 'password'} autoComplete="new-password" value={f.repetir} onChange={(e) => poner('repetir', e.target.value)} />
                  </Campo>
                  <button className="btn btn-oscuro btn-lg ancho" disabled={enviando}>{enviando ? 'Enviando cÃ³digoâ€¦' : 'Enviarme el cÃ³digo'} <Icon n="arrow" size={18} /></button>
                  <p className="auth-nota">Te enviaremos un cÃ³digo para verificar tu correo. Las cuentas de oficinista y cooperativa las crea el administrador.</p>
                </form>
              )}

              <div className="cuentas">
                <button className="cuentas-btn" onClick={() => setCuentas(!cuentas)} type="button">
                  Cuentas de prueba para la demo <Icon n="arrow" size={14} className={cuentas ? 'gira' : ''} />
                </button>
                {cuentas && (
                  <div className="cuentas-lista">
                    {USUARIOS_INICIALES.map((u) => (
                      <button key={u.id} type="button" onClick={() => usarCuenta(u)}>
                        <b>{ROLES[u.rol]}</b>
                        <span>{u.correo}</span>
                      </button>
                    ))}
                    <small>Toca una para rellenar el formulario.</small>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  )
}

function Campo({ icono, etiqueta, error, extra, children }) {
  return (
    <label className={'campo' + (error ? ' mal' : '')}>
      <span>{etiqueta}</span>
      <div className="campo-caja">
        <Icon n={icono} size={18} />
        {children}
        {extra}
      </div>
      {error && <small>{error}</small>}
    </label>
  )
}

