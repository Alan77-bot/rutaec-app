import { useState } from "react";
import { Badge, Button, Icon, Logo } from "../../../components/ui";

export default function Controller({ onExit = () => {} }: { onExit?: () => void }) {
  const [view, setView] = useState<"home" | "scanner" | "result">("home");
  const [scannedTicket, setScannedTicket] = useState({
    code: "REC-8F29-A71",
    passenger: "María Fernanda Torres",
    seat: "08",
    floor: "Piso 1",
    route: "Latacunga → Cuenca",
    time: "10:15",
    bus: "Unidad 18",
  });

  return (
    <div className="controller-app">
      <header>
        <Logo compact />
        <Badge tone="info">Unidad 18 · En ruta</Badge>
        <button className="text-btn" onClick={onExit}>
          Salir
        </button>
      </header>

      {view === "home" && (
        <main>
          <div className="mobile-greeting">
            <span>CONTROL DE EMBARQUE</span>
            <h1>Hola, Carlos</h1>
            <p>Controlador · Cooperativa Loja Internacional</p>
          </div>

          <div className="current-trip">
            <div className="trip-status">
              <Badge tone="success">En embarque</Badge>
              <span>Salida 10:15</span>
            </div>
            <div className="mobile-route">
              <div>
                <strong>10:15</strong>
                <span>Latacunga</span>
                <small>Terminal terrestre</small>
              </div>
              <i />
              <div>
                <strong>16:00</strong>
                <span>Cuenca</span>
                <small>Terminal terrestre</small>
              </div>
            </div>
            <div className="bus-info">
              <span>
                <Icon name="bus" size={14} /> Unidad 18
              </span>
              <span>
                <Icon name="users" size={14} /> 42 Asientos
              </span>
              <span>
                <Icon name="shield" size={14} /> Chofer: L. Rojas
              </span>
            </div>
            <div className="boarding-count">
              <div>
                <strong>14</strong>
                <span>Abordados</span>
              </div>
              <div>
                <strong>6</strong>
                <span>Esperando</span>
              </div>
              <div>
                <strong>22</strong>
                <span>Disponibles</span>
              </div>
            </div>
            <Button icon="qr" onClick={() => setView("scanner")}>
              Escanear boleto QR
            </Button>
          </div>

          <div className="mobile-section">
            <h3>Paradas de la ruta</h3>
            <div className="stop-list">
              <div className="active">
                <i />
                <span>
                  <strong>Latacunga · Terminal</strong>
                  <small>Embarque activo (14 abordados)</small>
                </span>
                <Badge tone="success">Actual</Badge>
              </div>
              <div>
                <i />
                <span>
                  <strong>Riobamba · Terminal</strong>
                  <small>Estimado 12:10 (4 pasajeros)</small>
                </span>
              </div>
              <div>
                <i />
                <span>
                  <strong>Cuenca · Terminal</strong>
                  <small>Estimado 16:00 (Desembarque)</small>
                </span>
              </div>
            </div>
          </div>
        </main>
      )}

      {view === "scanner" && (
        <div className="scanner">
          <div className="scanner-head">
            <button onClick={() => setView("home")}>
              <Icon name="close" />
            </button>
            <div>
              <strong>Escanear código QR</strong>
              <small>Apunta la cámara al boleto del pasajero</small>
            </div>
            <span style={{ width: 32 }} />
          </div>

          <div className="camera-frame">
            <span />
            <span />
            <span />
            <span />
            <div className="scan-line" />
            <div>
              <Icon name="qr" size={72} />
              <p style={{ marginTop: 12 }}>Centra el código QR en el visor</p>
            </div>
          </div>

          <p>La validación registrará el ingreso del pasajero de forma inmediata.</p>
          <Button variant="secondary" onClick={() => setView("result")}>
            Simular lectura exitosa
          </Button>
        </div>
      )}

      {view === "result" && (
        <main>
          <div className="validation-result">
            <div className="valid-icon">
              <Icon name="check" size={42} />
            </div>
            <Badge tone="success">Boleto válido y verificado</Badge>
            <h1>Acceso autorizado</h1>
            <p>El pasajero puede abordar a la unidad de transporte.</p>

            <div className="passenger-seat">
              <div>
                <span>ASIENTO</span>
                <strong>{scannedTicket.seat}</strong>
                <small>{scannedTicket.floor}</small>
              </div>
              <div>
                <span>PASAJERO</span>
                <strong>{scannedTicket.passenger}</strong>
                <small>{scannedTicket.route}</small>
              </div>
            </div>

            <div className="validation-time">
              <Icon name="check" />
              <span>
                <strong>Boleto marcado como ABORDADO</strong>
                <small>Registrado a las 09:58 · Terminal Latacunga</small>
              </span>
            </div>

            <Button icon="qr" onClick={() => setView("scanner")}>
              Escanear siguiente pasajero
            </Button>
            <Button variant="ghost" onClick={() => setView("home")}>
              Volver al resumen
            </Button>
          </div>
        </main>
      )}

      <nav className="mobile-nav">
        <button className={view === "home" ? "active" : ""} onClick={() => setView("home")}>
          <Icon name="home" size={20} />
          <span>Ruta</span>
        </button>
        <button className={view === "scanner" ? "active" : ""} onClick={() => setView("scanner")}>
          <Icon name="qr" size={20} />
          <span>Escanear</span>
        </button>
        <button onClick={() => alert("Lista de 14 pasajeros que ya han abordado.")}>
          <Icon name="users" size={20} />
          <span>Lista</span>
        </button>
        <button onClick={() => alert("Reporte de incidencias operativas del bus.")}>
          <Icon name="warning" size={20} />
          <span>Novedad</span>
        </button>
        <button onClick={onExit}>
          <Icon name="arrow" size={20} />
          <span>Salir</span>
        </button>
      </nav>
    </div>
  );
}
