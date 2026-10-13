import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { useApp } from '../../context/AppContext'
import { DESCUENTOS } from '../../data/viajes'
import Icon from '../../components/Icon'

const ESTADOS = {
  'Por validar': { clase: 'ambar', texto: 'Comprobante en revisiÃ³n. Te avisaremos por correo cuando el oficinista lo apruebe.' },
  Pagado: { clase: 'verde', texto: 'Pago confirmado. Presenta este cÃ³digo al abordar.' },
  Cancelado: { clase: 'rojo', texto: 'Este boleto fue cancelado.' },
}

export default function Boleto() {
  const { id } = useParams()
  const [q] = useSearchParams()
  const { compras, config, avisar, acciones } = useApp()
  const c = compras.find((x) => x.id === id)
  const [qr, setQr] = useState('')
  const [noExiste, setNoExiste] = useState(false)

  // si el boleto no estÃ¡ en la lista cargada (por ejemplo, un enlace directo), lo pedimos al servidor
  useEffect(() => {
    if (!c) acciones.obtenerCompra(id).catch(() => setNoExiste(true))
  }, [id, c, acciones])

  useEffect(() => {
    if (c) QRCode.toDataURL(`${c.codigo}|${c.viajeId}|${c.asientos.join(',')}`, { margin: 1, width: 220, color: { dark: '#1b3f68' } }).then(setQr)
  }, [c])

  if (!c) return <div className="contenedor vacio"><b>{noExiste ? 'No encontramos ese boleto.' : 'Cargando tu boletoâ€¦'}</b></div>

  const est = ESTADOS[c.estado]
  const valido = c.estado === 'Pagado'
  const fechaTxt = new Date(c.fecha).toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="contenedor boleto-pag">
      {q.get('nuevo') && (
        <div className="exito">
          <span className="check-anim"><Icon n="check" size={22} /></span>
          <div>
            <b>{c.estado === 'Pagado' ? 'Â¡Compra lista!' : 'Â¡Recibimos tu solicitud!'}</b>
            <p>Enviamos los detalles a {c.pasajeros[0].correo}.</p>
          </div>
        </div>
      )}
      <div className={'estado-franja ' + est.clase}>{c.estado}: {est.texto}</div>

      <article className={'boleto entra' + (valido ? '' : ' pendiente')}>
        <div className="boleto-izq">
          <div className="boleto-marca">{config.nombre}</div>
          <div className="ruta">
            <div><small>Origen</small><b>{c.origen}</b></div>
            <span>â†’</span>
            <div><small>Destino</small><b>{c.destino}</b></div>
          </div>
          <dl className="datos">
            <div><dt>Fecha</dt><dd>{fechaTxt}</dd></div>
            <div><dt>Salida</dt><dd>{c.hora}</dd></div>
            <div><dt>Cooperativa</dt><dd>{c.coopNombre}</dd></div>
            <div><dt>Bus</dt><dd>N.Âº {c.busNumero}</dd></div>
            <div><dt>MÃ©todo</dt><dd>{c.metodo}</dd></div>
            <div><dt>Total</dt><dd>${c.total.toFixed(2)}</dd></div>
          </dl>
          <div className="pas-lista">
            {c.pasajeros.map((p) => (
              <div key={p.asiento}>
                <b>{p.nombre}</b>
                <span>Asiento {p.asiento}{p.tipoAsiento === 'vip' ? ' Â· VIP' : ''}{p.descuento !== 'ninguno' ? ` Â· ${DESCUENTOS[p.descuento].nombre}` : ''}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="boleto-der">
          {qr && <img src={qr} alt="CÃ³digo QR del boleto" className={valido ? '' : 'qr-gris'} />}
          <b>{c.codigo}</b>
          <small>{valido ? 'Escanea al subir' : 'Se activa al aprobar el pago'}</small>
        </div>
      </article>

      <div className="acciones centro">
        <button className="btn btn-oscuro" onClick={() => window.print()}><Icon n="download" size={17} /> Descargar / imprimir</button>
        <button className="btn btn-claro" disabled={!valido} onClick={() => avisar('Pase enviado a Google Wallet (demo)')}><Icon n="wallet" size={17} /> Google Wallet</button>
        <button className="btn btn-claro" disabled={!valido} onClick={() => avisar('Pase agregado a Apple Wallet (demo)')}><Icon n="wallet" size={17} /> Apple Wallet</button>
        <Link to="/" className="btn btn-acento">Comprar otro boleto</Link>
      </div>
    </div>
  )
}

