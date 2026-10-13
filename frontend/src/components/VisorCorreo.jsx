import { Link } from 'react-router-dom'
import Icon from './Icon'

export function CuerpoCorreo({ cuerpo = [], onNavegar }) {
  return (
    <div className="mail-cuerpo">
      {cuerpo.map((b, i) => {
        if (b.t === 'p') return <p key={i}>{b.texto}</p>
        if (b.t === 'codigo') return <div key={i} className="mail-codigo">{b.valor.split('').map((d, k) => <span key={k}>{d}</span>)}</div>
        if (b.t === 'boton') return <Link key={i} to={b.ruta} onClick={onNavegar} className="btn btn-acento mail-boton">{b.texto}</Link>
        if (b.t === 'tabla') {
          return (
            <dl key={i} className="mail-tabla">
              {b.filas.map(([k, v]) => (
                <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
              ))}
            </dl>
          )
        }
        return null
      })}
    </div>
  )
}

export default function VisorCorreo({ correo, onCerrar, nombreApp }) {
  if (!correo) return null
  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <div className="modal modal-correo" onClick={(e) => e.stopPropagation()}>
        <button className="modal-x" onClick={onCerrar} aria-label="Cerrar"><Icon n="x" size={16} /></button>
        <div className="mail-cab">
          <h3>{correo.asunto}</h3>
          <p><b>De:</b> {nombreApp} &lt;no-responder@viajaya.ec&gt;</p>
          <p><b>Para:</b> {correo.para}</p>
          <p className="muted">{new Date(correo.hora).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' })}</p>
        </div>
        <CuerpoCorreo cuerpo={correo.cuerpo} onNavegar={onCerrar} />
      </div>
    </div>
  )
}
