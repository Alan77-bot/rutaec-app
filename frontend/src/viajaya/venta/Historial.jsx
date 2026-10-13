import { Link } from 'react-router-dom'
import { useApp } from '../ui/AppContext'
import { fechaCorta } from '../data/fechas'

const CLASE = { 'Por validar': 'ambar', Pagado: 'verde', Cancelado: 'rojo' }

export default function Historial() {
  const { compras, sesion } = useApp()
  const mias = compras.filter((c) => c.cliente === sesion?.correo)

  return (
    <div className="contenedor">
      <div className="seccion-cab izq">
        <h1>Mis viajes</h1>
        <p>Tus boletos quedan guardados para verlos cuando quieras.</p>
      </div>
      {mias.length === 0 && (
        <div className="vacio"><b>Todavía no compras ningún boleto.</b><p><Link to="/">Buscar un viaje</Link></p></div>
      )}
      <div className="hist">
        {mias.map((c) => (
          <Link key={c.id} to={`/boleto/${c.id}`} className="hist-item">
            <div className="hist-fecha"><b>{fechaCorta(c.fecha)}</b><small>{c.hora}</small></div>
            <div className="hist-ruta">
              <b>{c.origen} → {c.destino}</b>
              <small>{c.coopNombre} · {c.pasajeros.length} pasajero{c.pasajeros.length > 1 ? 's' : ''} · {c.codigo}</small>
            </div>
            <span className={'badge ' + CLASE[c.estado]}>{c.estado}</span>
            <b className="hist-total">${c.total.toFixed(2)}</b>
          </Link>
        ))}
      </div>
    </div>
  )
}
