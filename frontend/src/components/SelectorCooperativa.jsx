import { useEffect, useState } from 'react'
import { usePersonalizacion } from '../context/PersonalizacionContext'
import { obtenerCooperativas } from '../modules/cooperativas/services/cooperativas.service'

export default function SelectorCooperativa() {
  const { cooperativaId, seleccionarCooperativa } = usePersonalizacion()
  const [lista, setLista] = useState([])
  const [error, setError] = useState('')
  const [intento, setIntento] = useState(0)
  useEffect(() => {
    let vigente = true
    setError('')
    obtenerCooperativas().then(datos => { if (vigente) setLista(datos.filter(c => c.activa)) })
      .catch(e => { if (vigente) setError(e.message) })
    return () => { vigente = false }
  }, [intento])
  return <section className="selector-cooperativa" aria-label="Elegir cooperativa">
    <div><strong>¿Con quién quieres viajar?</strong><p>Compara todas las cooperativas o entra al espacio de una de ellas.</p></div>
    <label>Cooperativa
      <select value={cooperativaId || ''} onChange={e => seleccionarCooperativa(e.target.value)}>
        <option value="">Todas las cooperativas</option>
        {cooperativaId && !lista.some(c => c.id === cooperativaId) && <option value={cooperativaId}>Cooperativa seleccionada</option>}
        {lista.map(c => <option key={c.id} value={c.id}>{c.nombre_comercial}</option>)}
      </select>
    </label>
    {error && <p role="alert">{error} <button className="btn-link" onClick={() => setIntento(i => i + 1)}>Reintentar</button></p>}
  </section>
}
