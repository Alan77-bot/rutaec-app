import { useApp } from './AppContext'

export default function Footer() {
  const { config } = useApp()
  return (
    <footer className="footer">
      <div className="footer-in">
        <div>
          <b className="footer-marca">{config.nombre}</b>
          <p>Pasajes interprovinciales de las cooperativas del Ecuador, sin filas ni intermediarios.</p>
        </div>
        <div>
          <h5>Soporte</h5>
          <p>{config.soporteTel}</p>
          <p>{config.soporteMail}</p>
        </div>
        <div>
          <h5>Síguenos</h5>
          <p>Instagram {config.redes.instagram}</p>
          <p>Facebook {config.redes.facebook}</p>
          <p>WhatsApp {config.redes.whatsapp}</p>
        </div>
      </div>
      <div className="footer-pie">© {new Date().getFullYear()} {config.nombre} · Proyecto académico UTA</div>
    </footer>
  )
}
