import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../ui/AppContext'
import Icon from '../ui/Icon'
import Reveal, { Contador } from '../ui/Reveal'
import { precioTramo } from '../data/viajes'
import CoopLogo from '../ui/CoopLogo'
import { addDays, hoy } from '../data/fechas'

const DESTINOS = [
  { ciudad: 'Latacunga', foto: '/img/latacunga.png', nota: 'Puerta al Cotopaxi' },
  { ciudad: 'Riobamba', foto: '/img/riobamba.jpg', nota: 'Sultana de los Andes' },
  { ciudad: 'Quito', foto: '/img/quito-aerea.jpg', nota: 'Capital andina' },
  { ciudad: 'Guayaquil', foto: '/img/guayaquil.jpg', nota: 'Perla del Pacífico' },
  { ciudad: 'Cuenca', foto: '/img/cuenca.jpg', nota: 'Ciudad patrimonio' },
  { ciudad: 'Loja', foto: '/img/loja.jpg', nota: 'Capital musical del Ecuador' },
]

// Precio más bajo entre las frecuencias activas que unen origen y destino.
function precioDesde(frecuencias, o, d) {
  const lista = frecuencias
    .filter((f) => f.activa && f.tipo !== 'tour')
    .map((f) => {
      const i = f.paradas.indexOf(o)
      const j = f.paradas.indexOf(d)
      if (i < 0 || j <= i) return null
      if (f.tipo === 'directa' && !(i === 0 && j === f.paradas.length - 1)) return null
      return precioTramo(f, o, d)
    })
    .filter(Boolean)
  return lista.length ? Math.min(...lista) : null
}

const VENTAJAS = [
  { i: 'search', t: 'Todas las cooperativas', p: 'Compara horarios, buses y precios de varias cooperativas en una sola búsqueda.' },
  { i: 'route', t: 'Compra entre paradas', p: 'Sube en Latacunga y baja en Riobamba aunque el bus vaya de Quito a Loja.' },
  { i: 'ticket', t: 'Elige tu asiento', p: 'Mapa del bus con ventana, pasillo y VIP, según el tipo de bus.' },
  { i: 'shield', t: 'Pago verificado', p: 'Sube tu comprobante y el oficinista de la cooperativa lo valida.' },
  { i: 'qr', t: 'Boleto con QR', p: 'Lo ves cuando quieras en tu cuenta y también en tu wallet.' },
  { i: 'mail', t: 'Te avisamos por correo', p: 'Reserva, comprobante, aprobación y boleto: cada paso llega a tu bandeja.' },
]


// Una sola fila que se desliza con flechas, arrastre o automáticamente.
function Carrusel({ children }) {
  const pista = useRef(null)
  const pausa = useRef(false)
  const [borde, setBorde] = useState({ ini: true, fin: false })

  const medir = () => {
    const el = pista.current
    if (!el) return
    setBorde({ ini: el.scrollLeft < 8, fin: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 })
  }
  const mover = (dir) => {
    const el = pista.current
    const paso = el.firstElementChild.getBoundingClientRect().width + 18
    if (dir > 0 && el.scrollLeft + el.clientWidth >= el.scrollWidth - 8) el.scrollTo({ left: 0, behavior: 'smooth' })
    else el.scrollBy({ left: dir * paso, behavior: 'smooth' })
  }

  useEffect(() => {
    medir()
    const t = setInterval(() => {
      if (!pausa.current) mover(1)
    }, 4200)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="carrusel" onMouseEnter={() => (pausa.current = true)} onMouseLeave={() => (pausa.current = false)} onTouchStart={() => (pausa.current = true)}>
      <button className="flecha izq" onClick={() => mover(-1)} disabled={borde.ini} aria-label="Anterior"><Icon n="arrow" size={20} /></button>
      <div className="destinos" ref={pista} onScroll={medir}>{children}</div>
      <button className="flecha der" onClick={() => mover(1)} aria-label="Siguiente"><Icon n="arrow" size={20} /></button>
    </div>
  )
}

export default function Home() {
  const { cooperativas, config, frecuencias, ciudades } = useApp()
  const nav = useNavigate()
  const [origen, setOrigen] = useState('Ambato')
  const [destino, setDestino] = useState('Quito')
  const [fecha, setFecha] = useState(addDays(hoy(), 1))
  const [n, setN] = useState(1)

  const buscar = (e) => {
    e.preventDefault()
    nav(`/buscar?origen=${origen}&destino=${destino}&fecha=${fecha}&n=${n}`)
  }
  const cambiar = () => {
    setOrigen(destino)
    setDestino(origen)
  }

  return (
    <>
      <section className="hero" style={{ backgroundImage: 'url(/img/bus-azul.jpg)' }}>
        <div className="hero-velo" />
        <div className="hero-in">
          <p className="etiqueta pop" style={{ animationDelay: '.05s' }}>Pasajes interprovinciales · Ecuador</p>
          <h1 className="pop" style={{ animationDelay: '.15s' }}>Viaja entre provincias sin hacer fila en el terminal.</h1>
          <p className="hero-sub pop" style={{ animationDelay: '.28s' }}>Elige tu asiento, paga con transferencia y recibe tu boleto con código QR.</p>
          <div className="hero-stats pop" style={{ animationDelay: '.4s' }}>
            <div><b><Contador hasta={cooperativas.length} /></b><span>cooperativas</span></div>
            <div><b><Contador hasta={frecuencias.length} /></b><span>frecuencias</span></div>
            <div><b><Contador hasta={ciudades.length} /></b><span>ciudades</span></div>
          </div>
        </div>
      </section>

      <div className="buscador-wrap">
        <form className="buscador" onSubmit={buscar}>
          <label>
            <span><Icon n="pin" size={14} /> Origen</span>
            <select value={origen} onChange={(e) => setOrigen(e.target.value)}>
              {ciudades.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <button type="button" className="swap" onClick={cambiar} aria-label="Invertir origen y destino"><Icon n="swap" size={18} /></button>
          <label>
            <span><Icon n="pin" size={14} /> Destino</span>
            <select value={destino} onChange={(e) => setDestino(e.target.value)}>
              {ciudades.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label>
            <span><Icon n="calendar" size={14} /> Fecha</span>
            <input type="date" value={fecha} min={hoy()} onChange={(e) => setFecha(e.target.value)} />
          </label>
          <label className="corto">
            <span><Icon n="users" size={14} /> Pasajeros</span>
            <input type="number" min="1" max="6" value={n} onChange={(e) => setN(e.target.value)} />
          </label>
          <button className="btn btn-acento btn-lg" type="submit"><Icon n="search" size={18} /> Buscar</button>
        </form>
      </div>

      <section className="seccion">
        <div className="contenedor">
          <Reveal className="seccion-cab">
            <h2>Destinos con salida desde Ambato</h2>
            <p>Precio por pasajero, según la frecuencia más económica.</p>
          </Reveal>
          <Reveal>
            <Carrusel>
              {DESTINOS.map((d) => (
                <Link
                  key={d.ciudad}
                  className="destino"
                  to={`/buscar?origen=Ambato&destino=${d.ciudad}&fecha=${addDays(hoy(), 1)}&n=1`}
                >
                  <img src={d.foto} alt={`Vista de ${d.ciudad}`} loading="lazy" draggable="false" />
                  <div className="destino-info">
                    <small>{d.nota}</small>
                    <strong>{d.ciudad}</strong>
                    <span>desde <b>${(precioDesde(frecuencias, 'Ambato', d.ciudad) ?? 0).toFixed(2)}</b></span>
                  </div>
                  <i><Icon n="arrow" size={18} /></i>
                </Link>
              ))}
            </Carrusel>
          </Reveal>
        </div>
      </section>

      <section className="seccion crema">
        <div className="contenedor">
          <Reveal className="seccion-cab">
            <h2>Tres tipos de bus, tú eliges</h2>
            <p>Cada cooperativa define sus asientos; tú ves cuál te conviene antes de pagar.</p>
          </Reveal>
          <div className="tres-tipos">
            {[
              ['/img/bus-normal.jpg', 'Bus normal', 'Rutas con paradas intermedias, ideal para tramos cortos y medianos.'],
              ['/img/bus-azul.jpg', 'Bus de 2 pisos', 'Salidas directas y rápidas, con asientos VIP en el piso inferior.'],
              ['/img/chiva.jpg', 'Chiva turística', 'Paseos y tours cortos, como la vuelta por Baños. No hace rutas interprovinciales.'],
            ].map(([foto, nombre, txt], i) => (
              <Reveal key={nombre} delay={i * 110} as="article" className="tipo">
                <div className="tipo-foto"><img src={foto} alt={nombre} loading="lazy" /></div>
                <h3>{nombre}</h3>
                <p>{txt}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="seccion">
        <div className="contenedor">
          <Reveal className="tours">
            <div className="tours-foto"><img src="/img/chiva.jpg" alt="Chiva turística en Guayaquil" loading="lazy" /></div>
            <div className="tours-info">
              <p className="etiqueta oscuro">Turismo</p>
              <h2>Tours en chiva por todo el Ecuador</h2>
              <p className="muted">Las chivas son para pasear por la ciudad, no para viajar entre provincias. Reserva tu cupo igual que un pasaje.</p>
              <div className="tours-lista">
                {frecuencias.filter((f) => f.tipo === 'tour').map((t) => (
                  <Link key={t.id} to={`/comprar/${t.id}_${addDays(hoy(), 1)}?origen=${t.paradas[0]}&destino=${t.paradas[1]}&n=1`} className="tour-item">
                    <div>
                      <b>{t.titulo}</b>
                      <em className="tour-ciudad">{t.ciudad}</em>
                      <small>{t.detalle}</small>
                      <small>Sale {t.hora} · {t.duracion}</small>
                    </div>
                    <span>${t.precio.toFixed(2)}<Icon n="arrow" size={16} /></span>
                  </Link>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="seccion crema">
        <div className="contenedor">
          <Reveal className="seccion-cab">
            <h2>Pensado para viajar tranquilo</h2>
          </Reveal>
          <div className="ventajas">
            {VENTAJAS.map((v, i) => (
              <Reveal key={v.t} delay={(i % 3) * 90} className="ventaja">
                <span className="ventaja-ico"><Icon n={v.i} size={22} /></span>
                <h4>{v.t}</h4>
                <p>{v.p}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <Reveal as="section" className="banda" style={{ backgroundImage: 'url(/img/quito.jpg)' }}>
        <div className="banda-velo" />
        <div className="banda-in">
          <h2>¿Tienes una cooperativa de transporte?</h2>
          <p>Administra tus buses, tus frecuencias y la hoja de ruta, y vende en línea y en ventanilla desde un solo lugar.</p>
          <Link to="/ingresar" className="btn btn-acento btn-lg">Ingresar al panel <Icon n="arrow" size={18} /></Link>
        </div>
      </Reveal>

      <section className="seccion crema">
        <div className="contenedor">
          <Reveal className="seccion-cab">
            <h2>Cooperativas en {config.nombre}</h2>
          </Reveal>
          <div className="coops">
            {cooperativas.filter((c) => c.activa).map((c, i) => (
              <Reveal key={c.id} delay={i * 80} className="coop-chip" style={{ '--c': c.color }}>
                <CoopLogo coop={c} size={52} />
                <div><b>{c.nombre}</b><small>{c.ciudad}</small></div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
