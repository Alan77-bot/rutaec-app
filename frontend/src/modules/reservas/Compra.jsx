import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import CoopLogo from '../../components/CoopLogo'
import MapaAsientos from './MapaAsientos'
import {
  DESCUENTOS, asientosOcupados, busDeViaje, cedulaValida, layoutAsientos, precioFinal, precioTramo, totalCompra,
} from '../../data/viajes'
import { fechaLarga } from '../../data/fechas'

const PASOS = ['Asientos', 'Pasajeros', 'Pago']
const MINUTOS_RESERVA = 10

export default function Compra() {
  const { viajeId } = useParams()
  const [q] = useSearchParams()
  const nav = useNavigate()
  const { frecuencias, hojas, buses, ocupacion, cooperativas, sesion, acciones, ejecutar, avisar } = useApp()

  const [fid, fecha] = viajeId.split('_')
  const f = frecuencias.find((x) => x.id === fid)
  const origen = q.get('origen') || f?.paradas[0]
  const destino = q.get('destino') || f?.paradas.at(-1)
  const n = Number(q.get('n') || 1)
  const ventanilla = sesion?.rol === 'oficinista'

  const bus = f ? busDeViaje(hojas[f.coopId], buses, fid, fecha) : null
  const coop = f ? cooperativas.find((c) => c.id === f.coopId) : null

  const [paso, setPaso] = useState(0)
  const [elegidos, setElegidos] = useState([])
  const [pasajeros, setPasajeros] = useState([])
  const [metodo, setMetodo] = useState(ventanilla ? 'Efectivo' : 'DepÃ³sito')
  const [comprobante, setComprobante] = useState(null)
  const [errores, setErrores] = useState({})
  const [segundos, setSegundos] = useState(MINUTOS_RESERVA * 60)
  const [enviando, setEnviando] = useState(false)

  const asientos = useMemo(() => (bus ? layoutAsientos(bus.tipo) : []), [bus])
  const ocupados = useMemo(() => (bus ? asientosOcupados(viajeId, asientos, ocupacion) : new Set()), [bus, viajeId, asientos, ocupacion])

  useEffect(() => {
    if (paso < 2) return
    const t = setInterval(() => setSegundos((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [paso])

  if (!f || !bus) return <div className="contenedor vacio"><b>No encontramos ese viaje.</b><p><Link to="/">Volver al inicio</Link></p></div>

  const base = precioTramo(f, origen, destino)

  const clickAsiento = (a) => {
    setElegidos((e) => {
      if (e.includes(a.id)) return e.filter((x) => x !== a.id)
      if (e.length >= n) {
        avisar(`Solo viajas con ${n} pasajero${n > 1 ? 's' : ''}. Quita un asiento para cambiar.`)
        return e
      }
      return [...e, a.id]
    })
  }
  const dobleClick = (a) => {
    setElegidos((e) => (e.includes(a.id) || e.length >= n ? e : [...e, a.id]))
  }

  const irAPasajeros = () => {
    if (elegidos.length !== n) return avisar(`Elige ${n} asiento${n > 1 ? 's' : ''} para continuar.`)
    setPasajeros(
      elegidos.map((id, i) => {
        const a = asientos.find((x) => x.id === id)
        return {
          nombre: i === 0 && sesion?.rol === 'usuario' ? sesion.nombre : '',
          cedula: '',
          correo: i === 0 ? sesion?.correo || '' : '',
          descuento: 'ninguno',
          tipoAsiento: a.tipo,
          asiento: a.label,
          asientoId: id,
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
      if (!cedulaValida(p.cedula)) err[`c${i}`] = 'CÃ©dula no vÃ¡lida'
      if (!/^\S+@\S+\.\S+$/.test(p.correo)) err[`m${i}`] = 'Correo no vÃ¡lido'
    })
    setErrores(err)
    if (Object.keys(err).length) return avisar('Revisa los datos marcados en rojo.')
    setPaso(2)
  }

  const total = totalCompra(pasajeros, base)
  const mm = String(Math.floor(segundos / 60)).padStart(2, '0')
  const ss = String(segundos % 60).padStart(2, '0')

  const confirmar = async () => {
    if (metodo !== 'Efectivo' && !comprobante) return avisar('Sube el comprobante de pago para continuar.')
    if (segundos === 0 && metodo !== 'Efectivo') return avisar('La reserva venciÃ³, vuelve a elegir tus asientos.')
    setEnviando(true)
    const datos = {
      viajeId,
      origen,
      destino,
      metodo,
      pasajeros: pasajeros.map((p) => ({ nombre: p.nombre, cedula: p.cedula, correo: p.correo, descuento: p.descuento, asientoId: p.asientoId })),
    }
    const r = await ejecutar(() => acciones.crearCompra(datos, metodo === 'Efectivo' ? null : comprobante))
    setEnviando(false)
    if (r.ok) nav(`/boleto/${r.datos.id}?nuevo=1`)
  }

  return (
    <div className="contenedor compra">
      <Link to={-1} className="volver">â† Volver a resultados</Link>
      <div className="compra-cab">
        <CoopLogo coop={coop} size={64} />
        <div>
          <h1>{origen} â†’ {destino}</h1>
          <p>{fechaLarga(fecha)} Â· {f.hora} Â· {coop.nombre} N.Âº {bus.numero}</p>
        </div>
      </div>

      <ol className="pasos">
        {PASOS.map((p, i) => (
          <li key={p} className={i === paso ? 'activo' : i < paso ? 'hecho' : ''}><b>{i < paso ? 'âœ“' : i + 1}</b>{p}</li>
        ))}
      </ol>

      <div className="compra-grid">
        <section className="panel">
          {paso === 0 && (
            <>
              <h3>Elige {n} asiento{n > 1 ? 's' : ''}</h3>
              <div className="leyenda">
                <span><i className="asiento normal" />Normal</span>
                <span><i className="asiento vip" />VIP (+30%)</span>
                <span><i className="asiento ocupado" />Ocupado</span>
                <span><i className="asiento sel" />Tuyo</span>
              </div>
              <MapaAsientos tipo={bus.tipo} ocupados={ocupados} elegidos={elegidos} onClick={clickAsiento} onDoble={dobleClick} />
              <button className="btn btn-acento btn-lg" onClick={irAPasajeros}>Continuar</button>
            </>
          )}

          {paso === 1 && (
            <>
              <h3>Datos de los pasajeros</h3>
              {pasajeros.map((p, i) => (
                <fieldset key={p.asientoId} className="pasajero">
                  <legend>Asiento {p.asiento} {p.tipoAsiento === 'vip' && <em>VIP</em>}</legend>
                  <label className={errores[`n${i}`] ? 'err' : ''}>Nombre completo
                    <input value={p.nombre} onChange={(e) => cambiarPas(i, 'nombre', e.target.value)} />
                    {errores[`n${i}`] && <small>{errores[`n${i}`]}</small>}
                  </label>
                  <label className={errores[`c${i}`] ? 'err' : ''}>CÃ©dula
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
                    {p.descuento !== 'ninguno' && <small className="ayuda">Se valida con la cÃ©dula al abordar.</small>}
                  </label>
                </fieldset>
              ))}
              <div className="acciones">
                <button className="btn btn-claro" onClick={() => setPaso(0)}>AtrÃ¡s</button>
                <button className="btn btn-acento btn-lg" onClick={validarPasajeros}>Ir al pago</button>
              </div>
            </>
          )}

          {paso === 2 && (
            <>
              <h3>MÃ©todo de pago</h3>
              {metodo !== 'Efectivo' && (
                <div className={'reloj' + (segundos < 60 ? ' urgente' : '')}>
                  Tu reserva se mantiene <b>{mm}:{ss}</b> para subir el comprobante.
                </div>
              )}
              <div className="metodos">
                {ventanilla && (
                  <label className={metodo === 'Efectivo' ? 'on' : ''}>
                    <input type="radio" checked={metodo === 'Efectivo'} onChange={() => setMetodo('Efectivo')} />
                    <b>Efectivo</b><small>Cobro en ventanilla</small>
                  </label>
                )}
                <label className={metodo === 'DepÃ³sito' ? 'on' : ''}>
                  <input type="radio" checked={metodo === 'DepÃ³sito'} onChange={() => setMetodo('DepÃ³sito')} />
                  <b>DepÃ³sito</b><small>Sube la foto del comprobante</small>
                </label>
                <label className={metodo === 'Transferencia' ? 'on' : ''}>
                  <input type="radio" checked={metodo === 'Transferencia'} onChange={() => setMetodo('Transferencia')} />
                  <b>Transferencia</b><small>Desde tu banca en lÃ­nea</small>
                </label>
              </div>
              {metodo !== 'Efectivo' && (
                <div className="banco">
                  <p><b>Banco Pichincha</b> Â· Cta. corriente 2100123456 Â· {coop.nombre} Â· RUC {coop.ruc}</p>
                  <label className="subir">
                    <input type="file" accept="image/*,.pdf" onChange={(e) => setComprobante(e.target.files[0])} />
                    {comprobante ? `âœ“ ${comprobante.name}` : 'Subir comprobante (imagen o PDF)'}
                  </label>
                  <small className="ayuda">El oficinista lo revisarÃ¡ y recibirÃ¡s un correo con la respuesta.</small>
                </div>
              )}
              <div className="acciones">
                <button className="btn btn-claro" onClick={() => setPaso(1)}>AtrÃ¡s</button>
                <button className="btn btn-acento btn-lg" onClick={confirmar} disabled={enviando}>{enviando ? 'Enviandoâ€¦' : metodo === 'Efectivo' ? 'Cobrar y emitir boleto' : 'Enviar comprobante'}</button>
              </div>
            </>
          )}
        </section>

        <aside className="resumen">
          <h4>Resumen</h4>
          <p className="muted">{f.tipo === 'directa' ? 'Viaje directo' : 'Viaje con paradas'} Â· {f.duracion}</p>
          {(paso === 0 ? elegidos.map((id) => asientos.find((a) => a.id === id)).map((a) => ({ asiento: a.label, tipoAsiento: a.tipo, descuento: 'ninguno' })) : pasajeros).map((p) => (
            <div key={p.asiento} className="linea-r">
              <span>Asiento {p.asiento}{p.descuento !== 'ninguno' ? ` Â· ${DESCUENTOS[p.descuento].nombre}` : ''}</span>
              <b>${precioFinal(base, p.tipoAsiento, p.descuento).toFixed(2)}</b>
            </div>
          ))}
          {paso === 0 && elegidos.length === 0 && <p className="vacio-sm">AÃºn no eliges asientos.</p>}
          <div className="linea-r total"><span>Total</span><b>${(paso === 0 ? elegidos.reduce((s, id) => s + precioFinal(base, asientos.find((a) => a.id === id).tipo, 'ninguno'), 0) : total).toFixed(2)}</b></div>
        </aside>
      </div>
    </div>
  )
}

