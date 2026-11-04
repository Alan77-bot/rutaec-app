import { createContext, useContext, useEffect, useState } from 'react'
import { useApp } from './AppContext'
import { consultarPersonalizacion } from '../modules/cooperativas/services/personalizacion.service'
import '../styles/personalizacion.css'
import { useSearchParams } from 'react-router-dom'
import { cooperativaVisible } from '../data/acceso'

const Contexto = createContext(null)
export const usePersonalizacion = () => useContext(Contexto)

export function PersonalizacionProvider({ children }) {
  const { sesion } = useApp()
  const [consulta, setConsulta] = useSearchParams()
  const [seleccion, setSeleccion] = useState(() => {
    try { return sessionStorage.getItem('rutaec:cooperativa-publica') } catch { return null }
  })
  const explicita = consulta.get('cooperativa')
  const id = cooperativaVisible(sesion, explicita === null ? seleccion : explicita)
  useEffect(() => {
    if (explicita === null || (sesion && sesion.rol !== 'usuario')) return
    const valor = cooperativaVisible(sesion, explicita)
    setSeleccion(valor)
    try {
      if (valor) sessionStorage.setItem('rutaec:cooperativa-publica', valor)
      else sessionStorage.removeItem('rutaec:cooperativa-publica')
    } catch { /* La navegación funciona aunque el almacenamiento no esté disponible. */ }
  }, [explicita, sesion?.rol])
  const seleccionarCooperativa = valor => {
    if (sesion && sesion.rol !== 'usuario') return
    const nueva = new URLSearchParams(consulta)
    nueva.set('cooperativa', valor || 'todas')
    setConsulta(nueva)
  }
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const control = new AbortController()
    let numero = 0
    setDatos(null)
    setError('')
    if (!id) return () => control.abort()
    const cargar = async () => {
      const solicitud = ++numero
      try {
        const resultado = await consultarPersonalizacion(id, control.signal)
        if (!control.signal.aborted && solicitud === numero) { setDatos(resultado); setError('') }
      } catch (e) { if (!control.signal.aborted && solicitud === numero) setError(e.message) }
    }
    const actualizar = () => { if (!document.hidden) cargar() }
    // Invalida una consulta anterior para que no reemplace un guardado reciente.
    const guardar = (e) => { if (e.detail.id === id) { ++numero; setDatos(e.detail); setError('') } }
    cargar()
    const intervalo = setInterval(actualizar, 15000)
    window.addEventListener('focus', actualizar)
    document.addEventListener('visibilitychange', actualizar)
    window.addEventListener('coop:personalizacion', guardar)
    return () => {
      control.abort(); clearInterval(intervalo)
      window.removeEventListener('focus', actualizar)
      document.removeEventListener('visibilitychange', actualizar)
      window.removeEventListener('coop:personalizacion', guardar)
    }
  }, [id])
  const cooperativa = datos?.id === id ? datos : null
  const estilo = cooperativa ? {
    '--coop-primario': cooperativa.color_primario,
    '--coop-secundario': cooperativa.color_secundario,
    '--pino': cooperativa.color_primario,
    '--pino-2': cooperativa.color_primario,
    '--acento': cooperativa.color_primario,
  } : undefined
  return <Contexto.Provider value={{ cooperativa, cooperativaId: id, seleccionarCooperativa, error }}>
    <div className={cooperativa ? 'tema-cooperativa' : undefined} style={estilo}>
      {id && error && <p className="auth-aviso" role="status">No se pudo actualizar la identidad de tu cooperativa. Se reintentará automáticamente.</p>}
      {children}
    </div>
  </Contexto.Provider>
}
