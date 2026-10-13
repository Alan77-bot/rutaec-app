import { Button, Icon as UiIcon, Logo } from "../../../components/ui";
import type { Role } from "../../../types";

const roleInfo = [
  { id: "pasajero", title: "Pasajero", subtitle: "Buscar, comprar y gestionar viajes", icon: "ticket", color: "teal" },
  { id: "gerente", title: "Gerente de cooperativa", subtitle: "Flota, frecuencias y programación", icon: "bus", color: "blue" },
  { id: "oficinista", title: "Oficinista", subtitle: "Ventas y validación de pagos", icon: "wallet", color: "amber" },
  { id: "controlador", title: "Controlador del bus", subtitle: "Embarque y control de pasajeros", icon: "qr", color: "violet" },
  { id: "admin", title: "Administrador general", subtitle: "Cooperativas, usuarios y auditoría", icon: "shield", color: "navy" },
] as const;

export function DemoAccess({ setRole = () => {} }: { setRole?: (r: Role) => void }) {
  return (
    <main className="demo-page">
      <header className="public-header">
        <Logo />
        <div className="header-actions">
          <button className="text-btn" onClick={() => setRole("proyecto")}>
            Gestión del proyecto
          </button>
          <Button variant="secondary" onClick={() => setRole("login")}>
            Iniciar sesión
          </Button>
        </div>
      </header>
      <section className="demo-hero">
        <div className="eyebrow">
          <span /> Prototipo académico interactivo
        </div>
        <h1>
          Conecta cada ruta.<br />
          <em>Gestiona todo el viaje.</em>
        </h1>
        <p>
          Una plataforma ecuatoriana para comprar pasajes, operar cooperativas y demostrar procesos de control de cambios.
        </p>
      </section>
      <section className="role-section">
        <div className="section-heading">
          <div>
            <span className="overline">EXPLORA LA PLATAFORMA</span>
            <h2>Acceso de demostración del prototipo</h2>
          </div>
          <p>
            Selecciona un rol para recorrer sus funciones principales. Este selector no representa el mecanismo real de autorización.
          </p>
        </div>
        <div className="role-grid">
          {roleInfo.map((r, i) => (
            <button
              className={`role-card role-${r.color}`}
              key={r.id}
              onClick={() => setRole(r.id as Role)}
            >
              <span className="role-number">0{i + 1}</span>
              <span className="role-icon">
                <UiIcon name={r.icon} size={25} />
              </span>
              <strong>{r.title}</strong>
              <small>{r.subtitle}</small>
              <span className="role-open">
                Explorar <UiIcon name="arrow" size={17} />
              </span>
            </button>
          ))}
        </div>
        <div className="demo-note">
          <UiIcon name="shield" />
          <div>
            <strong>Entorno seguro de demostración</strong>
            <span>
              Los datos, pagos, autorizaciones, QR y resoluciones son ficticios. La autorización y prevención de doble venta requieren implementación en servidor.
            </span>
          </div>
        </div>
      </section>
      <footer>
        <span>RutaEC · Universidad Técnica de Ambato · 2026</span>
        <span>Prototipo v1.4.0</span>
      </footer>
    </main>
  );
}

export default DemoAccess;
