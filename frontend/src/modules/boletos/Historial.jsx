import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { boletosService } from './services/boletos.service'

const CLASE = { EMITIDO: 'verde', ANULADO: 'rojo' }
const ETIQUETA = { EMITIDO: 'Válido', ANULADO: 'Anulado' }
const ZONA = 'America/Guayaquil'

const fechaCorta = (v) => new Date(v).toLocaleDateString('es-EC', { timeZone: ZONA, day: '2-digit', month: 'short' })
const hora = (v) => new Date(v).toLocaleTimeString('es-EC', { timeZone: ZONA, hour: '2-digit', minute: '2-digit' })

export default function Historial() {
  const [boletos, setBoletos] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let activo = true
    boletosService
      .mios()
      .then((l) => activo && setBoletos(l))
      .catch((e) => activo && setError(e.message))
    return () => {
      activo = false
    }
  }, [])

  return (
    <div className="contenedor">
      <div className="seccion-cab izq">
        <h1>Mis viajes</h1>
        <p>Tus boletos quedan guardados para verlos cuando quieras.</p>
      </div>
      {error && <div className="vacio"><b>{error}</b></div>}
      {!error && boletos === null && <div className="vacio"><b>Cargando tus boletos…</b></div>}
      {boletos?.length === 0 && (
        <div className="vacio"><b>Todavía no tienes boletos.</b><p><Link to="/">Buscar un viaje</Link></p></div>
      )}
      <div className="hist">
        {boletos?.map((b) => (
          <Link key={b.id} to={`/boleto/${b.id}`} className="hist-item">
            <div className="hist-fecha"><b>{fechaCorta(b.datos.salida)}</b><small>{hora(b.datos.salida)}</small></div>
            <div className="hist-ruta">
              <b>{b.datos.origen} → {b.datos.destino}</b>
              <small>{b.datos.cooperativa} · Asiento {b.datos.asiento.numero} · {b.codigo.slice(0, 8).toUpperCase()}</small>
            </div>
            <span className={'badge ' + (CLASE[b.estado] ?? '')}>{ETIQUETA[b.estado] ?? b.estado}</span>
            <b className="hist-total">{b.datos.moneda} {Number(b.datos.importe).toFixed(2)}</b>
          </Link>
        ))}
      </div>
    </div>
  )
}
