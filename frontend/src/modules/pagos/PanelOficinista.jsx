import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { archivoProtegido } from '../../services/viajayaApi'
import { useApp } from '../../context/AppContext'
import Icon from '../../components/Icon'
import { addDays, fechaCorta, hoy } from '../../data/fechas'

export default function PanelOficinista() {
  const { compras, acciones, ejecutar, avisar, ciudades } = useApp()
  const nav = useNavigate()
  const [tab, setTab] = useState('validar')
  const [origen, setOrigen] = useState('Ambato')
  const [destino, setDestino] = useState('Quito')
  const [fecha, setFecha] = useState(hoy())
  const [n, setN] = useState(1)
  const [trabajando, setTrabajando] = useState(null)
  const [visor, setVisor] = useState(null)

  const pendientes = compras.filter((c) => c.estado === 'Por validar')
  const hechas = compras.filter((c) => c.estado !== 'Por validar').slice(0, 8)

  const resolver = async (c, ok) => {
    setTrabajando(c.id)
    await ejecutar(() => acciones.resolverCompra(c.id, ok), ok ? 'Pago aprobado y boleto generado. Se avisÃ³ al cliente por correo.' : 'Comprobante rechazado, se avisÃ³ al cliente.')
    setTrabajando(null)
  }

  const verComprobante = async (c) => {
    try {
      setVisor({ cargando: true, codigo: c.codigo })
      const a = await archivoProtegido(`/compras/${c.id}/comprobante`)
      setVisor({ ...a, codigo: c.codigo })
    } catch (e) {
      setVisor(null)
      avisar(e.message)
    }
  }
  const cerrarVisor = () => {
    if (visor?.url) URL.revokeObjectURL(visor.url)
    setVisor(null)
  }

  return (
    <div className="contenedor">
      <div className="seccion-cab izq">
        <h1>Ventanilla</h1>
        <p>Valida los depÃ³sitos y vende boletos en efectivo.</p>
      </div>
      <div className="tabs">
        <button className={tab === 'validar' ? 'on' : ''} onClick={() => setTab('validar')}>Por validar <i>{pendientes.length}</i></button>
        <button className={tab === 'vender' ? 'on' : ''} onClick={() => setTab('vender')}>Venta en ventanilla</button>
      </div>

      {tab === 'validar' && (
        <>
          {pendientes.length === 0 && <div className="vacio"><b>No hay comprobantes pendientes.</b></div>}
          <div className="cards-val">
            {pendientes.map((c) => (
              <article key={c.id} className="val">
                <button className="comprobante" onClick={() => verComprobante(c)} title="Ver el comprobante">
                  <Icon n="receipt" size={34} />
                  <small>Ver comprobante</small>
                </button>
                <div className="val-info">
                  <b>{c.origen} â†’ {c.destino}</b>
                  <span>{fechaCorta(c.fecha)} Â· {c.hora} Â· {c.coopNombre}</span>
                  <span>{c.pasajeros[0].nombre} Â· {c.pasajeros[0].correo}</span>
                  <span>{c.metodo} Â· {c.codigo}</span>
                </div>
                <div className="val-der">
                  <b className="precio">${c.total.toFixed(2)}</b>
                  <button className="btn btn-oscuro" disabled={trabajando === c.id} onClick={() => resolver(c, true)}>Aprobar</button>
                  <button className="btn btn-claro" disabled={trabajando === c.id} onClick={() => resolver(c, false)}>Rechazar</button>
                </div>
              </article>
            ))}
          </div>
          {hechas.length > 0 && (
            <>
              <h4 className="sub">Resueltos recientemente</h4>
              <div className="hist">
                {hechas.map((c) => (
                  <Link key={c.id} to={`/boleto/${c.id}`} className="hist-item">
                    <div className="hist-fecha"><b>{fechaCorta(c.fecha)}</b><small>{c.hora}</small></div>
                    <div className="hist-ruta"><b>{c.origen} â†’ {c.destino}</b><small>{c.codigo}</small></div>
                    <span className={'badge ' + (c.estado === 'Pagado' ? 'verde' : 'rojo')}>{c.estado}</span>
                    <b className="hist-total">${c.total.toFixed(2)}</b>
                  </Link>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {tab === 'vender' && (
        <form
          className="panel venta-rapida"
          onSubmit={(e) => {
            e.preventDefault()
            nav(`/buscar?origen=${origen}&destino=${destino}&fecha=${fecha}&n=${n}`)
          }}
        >
          <h3>Nueva venta en efectivo</h3>
          <div className="form-fila">
            <label>Origen<select value={origen} onChange={(e) => setOrigen(e.target.value)}>{ciudades.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label>Destino<select value={destino} onChange={(e) => setDestino(e.target.value)}>{ciudades.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label>Fecha<input type="date" min={hoy()} max={addDays(hoy(), 28)} value={fecha} onChange={(e) => setFecha(e.target.value)} /></label>
            <label>Pasajeros<input type="number" min="1" max="6" value={n} onChange={(e) => setN(e.target.value)} /></label>
          </div>
          <button className="btn btn-acento btn-lg">Buscar salidas</button>
        </form>
      )}

      {visor && (
        <div className="modal-fondo" onClick={cerrarVisor}>
          <div className="modal modal-comprobante" onClick={(e) => e.stopPropagation()}>
            <button className="modal-x" onClick={cerrarVisor} aria-label="Cerrar"><Icon n="x" size={16} /></button>
            <h3>Comprobante Â· {visor.codigo}</h3>
            {visor.cargando && <p className="muted">Abriendo el comprobanteâ€¦</p>}
            {visor.url && (visor.tipo === 'application/pdf'
              ? <iframe src={visor.url} title="Comprobante" className="visor-pdf" />
              : <img src={visor.url} alt="Comprobante de pago" className="visor-img" />)}
          </div>
        </div>
      )}
    </div>
  )
}

