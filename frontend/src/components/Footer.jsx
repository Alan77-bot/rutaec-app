import { useApp } from '../context/AppContext'
import { usePersonalizacion } from '../context/PersonalizacionContext'

function enlaceSeguro(valor) {
  try { const url = new URL(valor); return ['http:', 'https:'].includes(url.protocol) ? url.href : null } catch { return null }
}

export default function Footer() {
  const { config, sesion } = useApp()
  const { cooperativa: identidad } = usePersonalizacion()
  const cooperativa = sesion?.rol === 'admin' ? null : identidad
  const nombre = cooperativa?.nombre || config.nombre
  const telefono = cooperativa?.telefono || (!cooperativa ? config.soporteTel : '')
  const correo = cooperativa?.correo || (!cooperativa ? config.soporteMail : '')
  const redes = cooperativa?.redes_sociales || config.redes || {}
  const whatsapp = String(redes.whatsapp || '').replace(/\D/g, '')
  const color = cooperativa ? cooperativa.color_primario || cooperativa.color || '#16324F' : config.color || '#16324F'
  const rgb = /^#[a-f0-9]{6}$/i.test(color) ? color.slice(1).match(/../g).map(v => parseInt(v, 16) / 255) : [0, 0, 0]
  const luminancia = rgb.map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0)
  const texto = luminancia > .179 ? '#172033' : '#FFFFFF'
  return <footer className="footer" style={{ '--footer-fondo': color, '--footer-texto': texto }}>
    <div className="footer-in">
      <div>
        {cooperativa?.logo && <img className="footer-logo" src={cooperativa.logo} alt="" />}
        <b className="footer-marca">{nombre}</b>
        <p>{cooperativa ? cooperativa.direccion : 'Pasajes interprovinciales de las cooperativas del Ecuador, sin filas ni intermediarios.'}</p>
        {enlaceSeguro(cooperativa?.sitio_web) && <p><a href={enlaceSeguro(cooperativa.sitio_web)} target="_blank" rel="noopener noreferrer">Sitio web oficial</a></p>}
      </div>
      <div>
        <h5>Contacto y soporte</h5>
        {telefono && <p><a href={'tel:' + telefono.replace(/[^+\d]/g, '')}>{telefono}</a></p>}
        {correo && <p><a href={'mailto:' + correo}>{correo}</a></p>}
        {!telefono && !correo && <p>Información de contacto no disponible.</p>}
      </div>
      <div>
        <h5>Síguenos</h5>
        {['instagram', 'facebook'].map(red => enlaceSeguro(redes[red]) && <p key={red}><a href={enlaceSeguro(redes[red])} target="_blank" rel="noopener noreferrer">{red === 'instagram' ? 'Instagram' : 'Facebook'}</a></p>)}
        {whatsapp && <p><a href={'https://wa.me/' + whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp</a></p>}
        {!enlaceSeguro(redes.instagram) && !enlaceSeguro(redes.facebook) && !whatsapp && <p>Redes sociales no disponibles.</p>}
      </div>
    </div>
    <div className="footer-pie">© {new Date().getFullYear()} {nombre} · Proyecto académico UTA {import.meta.env.DEV && <a href="/correo-local" target="_blank" rel="noopener noreferrer"> · Correo local de desarrollo</a>}</div>
  </footer>
}
