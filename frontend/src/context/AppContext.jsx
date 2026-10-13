import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, guardarToken, hayToken } from '../services/viajayaApi'

const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

const AJUSTES_INICIALES = {
  nombre: 'ViajaYa',
  color: '#f2a33a',
  logo: null,
  soporteTel: '',
  soporteMail: '',
  redes: { instagram: '', facebook: '', whatsapp: '' },
}

const MODO_VISTA_PREVIA = true

export function AppProvider({ children }) {
  const [cargando, setCargando] = useState(true)
  const [errorRed, setErrorRed] = useState(null)
  const [sesion, setSesion] = useState(null)
  const [config, setConfig] = useState(AJUSTES_INICIALES)
  const [cooperativas, setCooperativas] = useState([])
  const [buses, setBuses] = useState([])
  const [frecuencias, setFrecuencias] = useState([])
  const [hojas, setHojas] = useState({})
  const [ocupacion, setOcupacion] = useState({})
  const [compras, setCompras] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [correos, setCorreos] = useState([])
  const [aviso, setAviso] = useState(null)

  const avisar = useCallback((texto) => {
    setAviso(texto)
    setTimeout(() => setAviso(null), 3400)
  }, [])

  useEffect(() => {
    document.documentElement.style.setProperty('--acento', config.color)
  }, [config.color])

  /* ---------- carga de datos ---------- */

  const cargarPublico = useCallback(async () => {
    const [pub, oc] = await Promise.all([api.get('/publico'), api.get('/ocupacion')])
    if (pub.ajustes) setConfig(pub.ajustes)
    setCooperativas(pub.cooperativas)
    setBuses(pub.buses)
    setFrecuencias(pub.frecuencias)
    setHojas(pub.hojas)
    setOcupacion(oc)
  }, [])

  const cargarPrivado = useCallback(async (s) => {
    const [c, m] = await Promise.all([api.get('/compras'), api.get('/correos')])
    setCompras(c)
    setCorreos(m)
    if (s.rol === 'admin') setUsuarios(await api.get('/usuarios'))
  }, [])

  const limpiarSesion = useCallback(() => {
    guardarToken(null)
    setSesion(null)
    setCompras([])
    setCorreos([])
    setUsuarios([])
  }, [])

  const arrancar = useCallback(async () => {
    setCargando(true)
    setErrorRed(null)
    try {
      if (MODO_VISTA_PREVIA) {
        setConfig(AJUSTES_INICIALES)
        setCooperativas([])
        setBuses([])
        setFrecuencias([])
        setHojas({})
        setOcupacion({})
        limpiarSesion()
        return
      }

      await cargarPublico()
      if (hayToken()) {
        try {
          const { sesion: s } = await api.get('/auth/yo')
          setSesion(s)
          await cargarPrivado(s)
        } catch (e) {
          if (e.estado === 401) limpiarSesion()
          else throw e
        }
      }
    } catch (e) {
      setErrorRed(e.message)
    } finally {
      setCargando(false)
    }
  }, [cargarPublico, cargarPrivado, limpiarSesion])

  useEffect(() => {
    arrancar()
  }, [arrancar])

  // La sesiÃ³n venciÃ³ en el servidor
  useEffect(() => {
    const f = () => {
      limpiarSesion()
      avisar('Tu sesiÃ³n venciÃ³, vuelve a ingresar.')
    }
    window.addEventListener('vy:sesion-vencida', f)
    return () => window.removeEventListener('vy:sesion-vencida', f)
  }, [limpiarSesion, avisar])

  // Actualiza cada pocos segundos para que lleguen las notificaciones y los asientos tomados por otras personas.
  useEffect(() => {
    if (MODO_VISTA_PREVIA || cargando || errorRed) return
    const t = setInterval(() => {
      if (document.hidden) return
      api.get('/ocupacion').then(setOcupacion).catch(() => {})
      if (sesion) {
        api.get('/compras').then(setCompras).catch(() => {})
        api.get('/correos').then(setCorreos).catch(() => {})
      }
    }, 12000)
    return () => clearInterval(t)
  }, [cargando, errorRed, sesion])

  /* ---------- sesiÃ³n ---------- */

  const entrarConRespuesta = useCallback(
    async ({ token, sesion: s }) => {
      guardarToken(token)
      setSesion(s)
      try {
        await cargarPrivado(s)
      } catch {
        /* se reintenta en la siguiente actualizaciÃ³n */
      }
      return s
    },
    [cargarPrivado]
  )

  const iniciarSesion = useCallback(
    async (correo, clave) => {
      try {
        const r = await api.post('/auth/login', { correo, clave })
        const s = await entrarConRespuesta(r)
        return { ok: true, sesion: s }
      } catch (e) {
        return { ok: false, campo: e.campo || 'correo', error: e.message }
      }
    },
    [entrarConRespuesta]
  )

  /* ---------- acciones (cada una lanza ApiError si el servidor las rechaza) ---------- */

  const acciones = useMemo(
    () => ({
      async crearCooperativa(datos) {
        const r = await api.post('/cooperativas', datos)
        setCooperativas((l) => [...l, r.cooperativa])
        setHojas((h) => ({ ...h, [r.cooperativa.id]: r.hoja }))
      },
      async alternarCooperativa(id, activa) {
        const c = await api.patch('/cooperativas/' + id, { activa })
        setCooperativas((l) => l.map((x) => (x.id === id ? c : x)))
      },
      async borrarCooperativa(id) {
        await api.del('/cooperativas/' + id)
        setCooperativas((l) => l.filter((x) => x.id !== id))
      },
      async crearBus(datos) {
        const b = await api.post('/buses', datos)
        setBuses((l) => [...l, b])
      },
      async quitarBus(id) {
        await api.del('/buses/' + id)
        setBuses((l) => l.filter((x) => x.id !== id))
        setHojas((h) => {
          const nueva = {}
          Object.entries(h).forEach(([k, v]) => {
            const celdas = { ...v.celdas }
            delete celdas[id]
            nueva[k] = { ...v, celdas }
          })
          return nueva
        })
      },
      async crearFrecuencia(datos) {
        const f = await api.post('/frecuencias', datos)
        setFrecuencias((l) => [...l, f])
      },
      async actualizarFrecuencia(id, parche) {
        const f = await api.patch('/frecuencias/' + id, parche)
        setFrecuencias((l) => l.map((x) => (x.id === id ? f : x)))
      },
      async guardarHoja(coopId, hoja) {
        const h = await api.put('/hojas/' + coopId, hoja)
        setHojas((l) => ({ ...l, [coopId]: h }))
      },
      async cargarUsuarios() {
        setUsuarios(await api.get('/usuarios'))
      },
      async crearUsuario(datos) {
        const u = await api.post('/usuarios', datos)
        setUsuarios((l) => [...l, u])
      },
      async borrarUsuario(id) {
        await api.del('/usuarios/' + id)
        setUsuarios((l) => l.filter((x) => x.id !== id))
      },
      async guardarAjustes(datos) {
        setConfig(await api.put('/ajustes', datos))
      },
      async crearCompra(datos, archivo) {
        const form = new FormData()
        form.append('datos', JSON.stringify(datos))
        if (archivo) form.append('comprobante', archivo)
        const c = await api.postForm('/compras', form)
        setCompras((l) => [c, ...l])
        api.get('/ocupacion').then(setOcupacion).catch(() => {})
        // los correos salen en segundo plano en el servidor
        setTimeout(() => api.get('/correos').then(setCorreos).catch(() => {}), 1200)
        return c
      },
      async obtenerCompra(id) {
        const c = await api.get('/compras/' + id)
        setCompras((l) => (l.some((x) => x.id === c.id) ? l.map((x) => (x.id === c.id ? c : x)) : [c, ...l]))
        return c
      },
      async resolverCompra(id, aprobar) {
        const c = await api.post(`/compras/${id}/${aprobar ? 'aprobar' : 'rechazar'}`)
        setCompras((l) => l.map((x) => (x.id === id ? c : x)))
        setTimeout(() => api.get('/correos').then(setCorreos).catch(() => {}), 1200)
        return c
      },
    }),
    []
  )

  // Ejecuta una acciÃ³n mostrando el error del servidor (si lo hay) y devuelve { ok, datos }.
  const ejecutar = useCallback(
    async (fn, mensajeOk) => {
      try {
        const datos = await fn()
        if (mensajeOk) avisar(mensajeOk)
        return { ok: true, datos }
      } catch (e) {
        avisar(e.message || 'OcurriÃ³ un error inesperado.')
        return { ok: false, error: e }
      }
    },
    [avisar]
  )

  const marcarLeidos = useCallback(async () => {
    if (!sesion) return
    try {
      await api.post('/correos/leidos')
      setCorreos((l) => l.map((c) => (c.para === sesion.correo ? { ...c, leido: true } : c)))
    } catch {
      /* no es crÃ­tico */
    }
  }, [sesion])

  const ciudades = useMemo(
    () => [...new Set(frecuencias.filter((f) => f.tipo !== 'tour' && f.activa).flatMap((f) => f.paradas))].sort(),
    [frecuencias]
  )

  const valor = useMemo(
    () => ({
      cargando, errorRed, reintentar: arrancar,
      sesion, setSesion, iniciarSesion, entrarConRespuesta, cerrarSesion: limpiarSesion,
      config, cooperativas, buses, frecuencias, hojas, ocupacion, compras, usuarios, correos, ciudades,
      acciones, ejecutar, marcarLeidos, aviso, avisar,
    }),
    [cargando, errorRed, arrancar, sesion, iniciarSesion, entrarConRespuesta, limpiarSesion, config, cooperativas, buses, frecuencias, hojas, ocupacion, compras, usuarios, correos, ciudades, acciones, ejecutar, marcarLeidos, aviso, avisar]
  )

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}



