import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import CodigoQr from './CodigoQr'
import { boletosService } from './services/boletos.service'

const ESTADOS = {
  EMITIDO: { clase: 'verde', etiqueta: 'Válido', texto: 'Pago confirmado. Presenta este código al abordar.' },
  ANULADO: { clase: 'rojo', etiqueta: 'Anulado', texto: 'Este boleto fue anulado y ya no es válido.' },
}

const ZONA = 'America/Guayaquil'
const fechaLarga = (v) =>
  new Date(v).toLocaleDateString('es-EC', { timeZone: ZONA, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const hora = (v) => new Date(v).toLocaleTimeString('es-EC', { timeZone: ZONA, hour: '2-digit', minute: '2-digit' })

export default function Boleto() {
  const { id } = useParams()
  const [q] = useSearchParams()
  const [boleto, setBoleto] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let activo = true
    boletosService
      .obtener(id)
      .then((b) => activo && setBoleto(b))
      .catch((e) => activo && setError(e.message))
    return () => {
      activo = false
    }
  }, [id])

  if (error) return <div className="contenedor vacio"><b>{error}</b><p><Link to="/mis-viajes">Volver a mis viajes</Link></p></div>
  if (!boleto) return <div className="contenedor vacio"><b>Cargando tu boleto…</b></div>

  const d = boleto.datos
  const est = ESTADOS[boleto.estado] ?? ESTADOS.EMITIDO
  const valido = boleto.estado === 'EMITIDO'
  const nombre = `${d.pasajero.nombres ?? ''} ${d.pasajero.apellidos ?? ''}`.trim()

  return (
    <div className="contenedor boleto-pag">
      {q.get('nuevo') && (
        <div className="exito">
          <span className="check-anim"><Icon n="check" size={22} /></span>
          <div>
            <b>¡Compra lista!</b>
            <p>También te enviamos los boletos por correo.</p>
          </div>
        </div>
      )}
      <div className={'estado-franja ' + est.clase}>{est.etiqueta}: {est.texto}</div>

      <article className={'boleto entra' + (valido ? '' : ' pendiente')}>
        <div className="boleto-izq">
          <div className="boleto-marca">{d.cooperativa}</div>
          <div className="ruta">
            <div><small>Origen</small><b>{d.origen}</b></div>
            <span>→</span>
            <div><small>Destino</small><b>{d.destino}</b></div>
          </div>
          <dl className="datos">
            <div><dt>Fecha</dt><dd>{fechaLarga(d.salida)}</dd></div>
            <div><dt>Salida</dt><dd>{hora(d.salida)}</dd></div>
            <div><dt>Llegada</dt><dd>{hora(d.llegada)}</dd></div>
            <div><dt>Bus</dt><dd>{d.unidad ? `N.º ${d.unidad}` : '—'}{d.placa ? ` · ${d.placa}` : ''}</dd></div>
            <div><dt>Asiento</dt><dd>{d.asiento.numero}{d.asiento.categoria ? ` · ${d.asiento.categoria}` : ''}</dd></div>
            <div><dt>Total</dt><dd>{d.moneda} {Number(d.importe).toFixed(2)}</dd></div>
          </dl>
          <div className="pas-lista">
            <div><b>{nombre}</b><span>Asiento {d.asiento.numero}</span></div>
          </div>
        </div>
        <div className="boleto-der">
          {boleto.qr && <CodigoQr token={boleto.qr} anulado={!valido} />}
          <b>{boleto.codigo.slice(0, 8).toUpperCase()}</b>
          <small>{valido ? 'Escanea al subir' : 'Boleto anulado'}</small>
        </div>
      </article>

      <div className="acciones centro">
        <a className="btn btn-oscuro" href={boletosService.urlPdf(boleto.id)} download>
          <Icon n="download" size={17} /> Descargar PDF
        </a>
        <Link to="/mis-viajes" className="btn btn-claro">Mis viajes</Link>
        <Link to="/" className="btn btn-acento">Comprar otro boleto</Link>
      </div>
    </div>
  )
}
