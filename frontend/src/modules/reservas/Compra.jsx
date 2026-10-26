import { useCallback, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import CoopLogo from '../../components/CoopLogo'
import MapaAsientos from './MapaAsientos'
import { useDisponibilidad } from './useDisponibilidad'
import {
  ESTILO_ACCESIBLE,
  ESTILO_PREFERENCIAL,
  ESTILO_RETENIDO,
} from './asientos.estilos'
import { urlResultados } from './reservas.enlaces'
import { DESCUENTOS, cedulaValida } from '../../data/viajes'
import { fechaLarga } from '../../data/fechas'

const PASOS = ['Asientos', 'Pasajeros', 'Pago']

const dinero = (valor) => `$${valor.toFixed(2)}`
const conDescuento = (precio, descuento) => precio * (1 - DESCUENTOS[descuento].pct)

function Aviso({ titulo, texto, children }) {
  return (
    <div className="contenedor vacio">
      <b>{titulo}</b>
      {texto && <p>{texto}</p>}
      {children}
    </div>
  )
}

export default function Compra() {
  const { viajeId } = useParams()
  const [q] = useSearchParams()
  const { sesion, avisar } = useApp()

  const origen = q.get('origen') || ''
  const destino = q.get('destino') || ''
  const fecha = q.get('fecha') || ''
  const n = Math.max(1, Number(q.get('n')) || 1)
  const ventanilla = sesion?.rol === 'oficinista'
  const volver = urlResultados({ origen, destino, fecha, pasajeros: n })

  const [paso, setPaso] = useState(0)
  const [elegidos, setElegidos] = useState([])

  // Si otra persona toma un asiento que elegiste mientras decides, se te quita de
  // la seleccion y se te avisa. Solo aplica al paso de asientos.
  const alActualizar = useCallback(
    (datos) => {
      if (paso !== 0) return
      const libres = new Set(datos.asientos.filter((a) => a.estado === 'LIBRE').map((a) => a.id))
      const perdidos = elegidos.filter((id) => !libres.has(id))
      if (perdidos.length === 0) return

      const numeros = perdidos.map((id) => datos.asientos.find((a) => a.id === id)?.numero).filter(Boolean)
      setElegidos(elegidos.filter((id) => libres.has(id)))
      avisar(
        numeros.length === 1
          ? `El asiento ${numeros[0]} ya no está disponible: lo tomó otra persona. Elige otro.`
          : `Los asientos ${numeros.join(', ')} ya no están disponibles: los tomó otra persona. Elige otros.`
      )
    },
    [paso, elegidos, avisar]
  )

  const { disponibilidad, cargando, error, recargar } = useDisponibilidad(
    { viajeId, origen, destino },
    { alActualizar }
  )

  const [pasajeros, setPasajeros] = useState([])
  const [metodo, setMetodo] = useState(ventanilla ? 'Efectivo' : 'Depósito')
  const [comprobante, setComprobante] = useState(null)
  const [errores, setErrores] = useState({})

  const asientos = useMemo(() => disponibilidad?.asientos ?? [], [disponibilidad])
  const porId = useMemo(() => new Map(asientos.map((a) => [a.id, a])), [asientos])

  if (!origen || !destino) {
    return (
      <Aviso titulo="Faltan los datos de tu búsqueda." texto="Vuelve a buscar el viaje para elegir tus asientos.">
        <Link className="btn btn-oscuro" to="/buscar">Buscar viajes</Link>
      </Aviso>
    )
  }

  if (cargando) return <Aviso titulo="Cargando los asientos…" />

  if (error?.estado === 404) {
    return (
      <Aviso titulo="Este viaje ya no está disponible." texto="Pudo haberse cerrado la venta o cambiado el recorrido.">
        <Link className="btn btn-oscuro" to={volver}>Volver a los resultados</Link>
      </Aviso>
    )
  }

  if (error) {
    return (
      <Aviso titulo={error.message}>
        {(error.estado === 0 || error.estado >= 500) && (
          <button className="btn btn-oscuro" onClick={recargar}>Reintentar</button>
        )}
      </Aviso>
    )
  }

  const { viaje } = disponibilidad
  const coop = viaje.coop
  const precioNormal = viaje.precio
  const precioVip = viaje.precioVip
  const hayAccesibles = asientos.some((a) => a.accesible)
  const hayPreferenciales = asientos.some((a) => a.preferencial && !a.accesible)

  const clickAsiento = (a) => {
    setElegidos((actuales) => {
      if (actuales.includes(a.id)) return actuales.filter((x) => x !== a.id)
      if (actuales.length >= n) {
        avisar(`Solo viajas con ${n} pasajero${n > 1 ? 's' : ''}. Quita un asiento para cambiar.`)
        return actuales
      }
      return [...actuales, a.id]
    })
  }

  const asientoNoDisponible = (a) => {
    avisar(
      a.estado === 'RETENIDO'
        ? `El asiento ${a.numero} lo acaba de reservar otra persona.`
        : `El asiento ${a.numero} no está disponible.`
    )
  }

  const irAPasajeros = () => {
    if (elegidos.length !== n) return avisar(`Elige ${n} asiento${n > 1 ? 's' : ''} para continuar.`)
    setPasajeros(
      elegidos.map((id, i) => {
        const a = porId.get(id)
        return {
          nombre: i === 0 && sesion?.rol === 'usuario' ? sesion.nombre : '',
          cedula: '',
          correo: i === 0 ? sesion?.correo || '' : '',
          descuento: 'ninguno',
          categoria: a.categoria,
          asiento: a.numero,
          asientoId: id,
          precio: a.precio ?? 0,
        }
      })
    )
    setPaso(1)
  }

  const cambiarPas = (i, campo, valor) =>
    setPasajeros((ps) => ps.map((p, k) => (k === i ? { ...p, [campo]: valor } : p)))

  const validarPasajeros = () => {
    const err = {}
    pasajeros.forEach((p, i) => {
      if (p.nombre.trim().length < 3) err[`n${i}`] = 'Escribe el nombre completo'
      if (!cedulaValida(p.cedula)) err[`c${i}`] = 'Cédula no válida'
      if (!/^\S+@\S+\.\S+$/.test(p.correo)) err[`m${i}`] = 'Correo no válido'
    })
    setErrores(err)
    if (Object.keys(err).length) return avisar('Revisa los datos marcados en rojo.')
    setPaso(2)
  }

  const total = pasajeros.reduce((suma, p) => suma + conDescuento(p.precio, p.descuento), 0)
  const totalElegidos = elegidos.reduce((suma, id) => suma + (porId.get(id)?.precio ?? 0), 0)

  // La reserva y el pago reales se conectan en la Issue #17.
  const confirmar = () => {
    if (metodo !== 'Efectivo' && !comprobante) return avisar('Sube el comprobante de pago para continuar.')
    avisar('La reserva y el pago se conectan en la siguiente entrega (Issue #17).')
  }

  const lineas =
    paso === 0
      ? elegidos.map((id) => {
          const a = porId.get(id)
          return { asiento: a.numero, descuento: 'ninguno', precio: a.precio ?? 0 }
        })
      : pasajeros

  return (
    <div className="contenedor compra">
      <Link to={volver} className="volver">← Volver a resultados</Link>
      <div className="compra-cab">
        <CoopLogo coop={coop} size={64} />
        <div>
          <h1>{origen} → {destino}</h1>
          <p>{fecha && `${fechaLarga(fecha)} · `}{viaje.horaSalida} · {coop.nombre} N.º {viaje.bus.numero}</p>
        </div>
      </div>

      <ol className="pasos">
        {PASOS.map((p, i) => (
          <li key={p} className={i === paso ? 'activo' : i < paso ? 'hecho' : ''}><b>{i < paso ? '✓' : i + 1}</b>{p}</li>
        ))}
      </ol>

      <div className="compra-grid">
        <section className="panel">
          {paso === 0 && (
            <>
              <h3>Elige {n} asiento{n > 1 ? 's' : ''}</h3>
              <div className="leyenda">
                <span><i className="asiento normal" />Normal{precioNormal !== null && ` · ${dinero(precioNormal)}`}</span>
                <span><i className="asiento vip" />VIP{precioVip !== null && ` · ${dinero(precioVip)}`}</span>
                <span><i className="asiento ocupado" />Ocupado</span>
                <span><i className="asiento ocupado" style={ESTILO_RETENIDO} />Reservado por otra persona</span>
                {hayAccesibles && <span><i className="asiento" style={ESTILO_ACCESIBLE} />Accesible</span>}
                {hayPreferenciales && <span><i className="asiento" style={ESTILO_PREFERENCIAL} />Preferencial</span>}
                <span><i className="asiento sel" />Tuyo</span>
              </div>
              <MapaAsientos
                asientos={asientos}
                elegidos={elegidos}
                onElegir={clickAsiento}
                onNoDisponible={asientoNoDisponible}
              />
              <button className="btn btn-acento btn-lg" onClick={irAPasajeros}>Continuar</button>
            </>
          )}

          {paso === 1 && (
            <>
              <h3>Datos de los pasajeros</h3>
              {pasajeros.map((p, i) => (
                <fieldset key={p.asientoId} className="pasajero">
                  <legend>Asiento {p.asiento} {p.categoria === 'VIP' && <em>VIP</em>}</legend>
                  <label className={errores[`n${i}`] ? 'err' : ''}>Nombre completo
                    <input value={p.nombre} onChange={(e) => cambiarPas(i, 'nombre', e.target.value)} />
                    {errores[`n${i}`] && <small>{errores[`n${i}`]}</small>}
                  </label>
                  <label className={errores[`c${i}`] ? 'err' : ''}>Cédula
                    <input value={p.cedula} inputMode="numeric" maxLength={10} onChange={(e) => cambiarPas(i, 'cedula', e.target.value)} />
                    {errores[`c${i}`] && <small>{errores[`c${i}`]}</small>}
                  </label>
                  <label className={errores[`m${i}`] ? 'err' : ''}>Correo
                    <input value={p.correo} onChange={(e) => cambiarPas(i, 'correo', e.target.value)} />
                    {errores[`m${i}`] && <small>{errores[`m${i}`]}</small>}
                  </label>
                  <label>Descuento
                    <select value={p.descuento} onChange={(e) => cambiarPas(i, 'descuento', e.target.value)}>
                      {Object.entries(DESCUENTOS).map(([k, d]) => <option key={k} value={k}>{d.nombre}{d.pct ? ' (50%)' : ''}</option>)}
                    </select>
                    {p.descuento !== 'ninguno' && <small className="ayuda">Se valida con la cédula al abordar.</small>}
                  </label>
                </fieldset>
              ))}
              <div className="acciones">
                <button className="btn btn-claro" onClick={() => setPaso(0)}>Atrás</button>
                <button className="btn btn-acento btn-lg" onClick={validarPasajeros}>Ir al pago</button>
              </div>
            </>
          )}

          {paso === 2 && (
            <>
              <h3>Método de pago</h3>
              <div className="metodos">
                {ventanilla && (
                  <label className={metodo === 'Efectivo' ? 'on' : ''}>
                    <input type="radio" checked={metodo === 'Efectivo'} onChange={() => setMetodo('Efectivo')} />
                    <b>Efectivo</b><small>Cobro en ventanilla</small>
                  </label>
                )}
                <label className={metodo === 'Depósito' ? 'on' : ''}>
                  <input type="radio" checked={metodo === 'Depósito'} onChange={() => setMetodo('Depósito')} />
                  <b>Depósito</b><small>Sube la foto del comprobante</small>
                </label>
                <label className={metodo === 'Transferencia' ? 'on' : ''}>
                  <input type="radio" checked={metodo === 'Transferencia'} onChange={() => setMetodo('Transferencia')} />
                  <b>Transferencia</b><small>Desde tu banca en línea</small>
                </label>
              </div>
              {metodo !== 'Efectivo' && (
                <div className="banco">
                  <p>Los datos bancarios de <b>{coop.nombre}</b> se muestran al confirmar la reserva.</p>
                  <label className="subir">
                    <input type="file" accept="image/*,.pdf" onChange={(e) => setComprobante(e.target.files[0])} />
                    {comprobante ? `✓ ${comprobante.name}` : 'Subir comprobante (imagen o PDF)'}
                  </label>
                  <small className="ayuda">El oficinista lo revisará y recibirás un correo con la respuesta.</small>
                </div>
              )}
              <div className="acciones">
                <button className="btn btn-claro" onClick={() => setPaso(1)}>Atrás</button>
                <button className="btn btn-acento btn-lg" onClick={confirmar}>
                  {metodo === 'Efectivo' ? 'Cobrar y emitir boleto' : 'Enviar comprobante'}
                </button>
              </div>
            </>
          )}
        </section>

        <aside className="resumen">
          <h4>Resumen</h4>
          <p className="muted">{viaje.tipoViaje === 'directa' ? 'Viaje directo' : 'Viaje con paradas'} · {viaje.duracion}</p>
          {lineas.map((p) => (
            <div key={p.asiento} className="linea-r">
              <span>Asiento {p.asiento}{p.descuento !== 'ninguno' ? ` · ${DESCUENTOS[p.descuento].nombre}` : ''}</span>
              <b>{dinero(conDescuento(p.precio, p.descuento))}</b>
            </div>
          ))}
          {paso === 0 && elegidos.length === 0 && <p className="vacio-sm">Aún no eliges asientos.</p>}
          <div className="linea-r total"><span>Total</span><b>{dinero(paso === 0 ? totalElegidos : total)}</b></div>
        </aside>
      </div>
    </div>
  )
}
