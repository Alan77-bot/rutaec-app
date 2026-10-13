import { useState } from "react";
import { busImage, cuencaImage, heroImage } from "../../../assets";
import { Badge, Button, Field, Icon, Logo, SeatMap, SelectField } from "../../../components/ui";

export default function Passenger({ onExit = () => {} }: { onExit?: () => void }) {
  const [step, setStep] = useState(0);
  const [selectedSeat, setSelectedSeat] = useState(0);
  const [toast, setToast] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [paymentState, setPaymentState] = useState<"upload" | "review" | "approved">("upload");

  const next = () => setStep((s) => Math.min(6, s + 1));
  const showPassengerMessage = (message: string) => {
    setToast(message);
    setMobileNavOpen(false);
  };

  return (
    <div className="passenger-app">
      <header className="passenger-header">
        <Logo />
        <nav>
          <button onClick={() => setStep(0)}>Buscar viajes</button>
          <button onClick={() => showPassengerMessage("Tienes 2 próximos viajes y 1 pago pendiente.")}>
            Mis viajes
          </button>
          <button onClick={() => showPassengerMessage("Centro de ayuda disponible de 06:00 a 22:00.")}>
            Ayuda
          </button>
        </nav>
        <div>
          <button className="icon-button" aria-label="Notificaciones">
            <Icon name="bell" />
            <i />
          </button>
          <span className="avatar">MT</span>
          <button className="text-btn passenger-exit" onClick={onExit}>
            Salir
          </button>
          <button
            className="passenger-mobile-menu"
            aria-label="Abrir navegación"
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen((open) => !open)}
          >
            <Icon name={mobileNavOpen ? "close" : "menu"} />
          </button>
        </div>
        {mobileNavOpen && (
          <div className="passenger-mobile-nav">
            <button
              onClick={() => {
                setStep(0);
                setMobileNavOpen(false);
              }}
            >
              <Icon name="search" />Buscar viajes
            </button>
            <button onClick={() => showPassengerMessage("Tienes 2 próximos viajes y 1 pago pendiente.")}>
              <Icon name="ticket" />Mis viajes
            </button>
            <button onClick={() => showPassengerMessage("Centro de ayuda disponible de 06:00 a 22:00.")}>
              <Icon name="shield" />Ayuda
            </button>
            <button onClick={onExit}>
              <Icon name="arrow" />Salir de la cuenta
            </button>
          </div>
        )}
      </header>
      {step === 0 ? (
        <PassengerHome onSearch={next} />
      ) : (
        <div className="purchase-shell">
          <Progress step={step} />
          {step === 1 && <Results onSelect={next} onBack={() => setStep(0)} />}
          {step === 2 && (
            <SeatSelection selected={selectedSeat} setSelected={setSelectedSeat} onNext={next} />
          )}
          {step === 3 && <PassengerForm onNext={next} seat={selectedSeat} />}
          {step === 4 && <Payment state={paymentState} setState={setPaymentState} onNext={next} />}
          {step === 5 && <PaymentReview onNext={next} />}
          {step === 6 && <DigitalTicket onExit={() => setStep(0)} />}
        </div>
      )}
      {toast && (
        <div className="toast">
          <Icon name="check" />
          <span>{toast}</span>
          <button onClick={() => setToast("")}>
            <Icon name="close" />
          </button>
        </div>
      )}
    </div>
  );
}

function PassengerHome({ onSearch }: { onSearch: () => void }) {
  return (
    <main>
      <section
        className="travel-hero"
        style={{
          backgroundImage: `linear-gradient(90deg,rgba(8,25,48,.88),rgba(8,25,48,.2)),url(${heroImage})`,
        }}
      >
        <div className="hero-content">
          <Badge tone="info">Viaja por Ecuador</Badge>
          <h1>Tu camino, más simple.</h1>
          <p>Compara horarios, elige tu asiento y compra tu pasaje en minutos.</p>
        </div>
        <div className="search-card">
          <div className="search-fields">
            <SelectField
              label="Origen"
              value="Latacunga"
              options={["Latacunga", "Quito", "Riobamba", "Cuenca", "Loja"]}
            />
            <button className="swap" aria-label="Intercambiar origen y destino">
              ⇄
            </button>
            <SelectField
              label="Destino"
              value="Cuenca"
              options={["Cuenca", "Quito", "Riobamba", "Loja"]}
            />
            <Field label="Fecha" value="15/11/2026" />
            <SelectField label="Pasajeros" options={["1 pasajero", "2 pasajeros", "3 pasajeros"]} />
          </div>
          <Button icon="search" onClick={onSearch}>
            Buscar viajes
          </Button>
          <small>
            <Icon name="check" size={14} /> La búsqueda incluye ciudades que son paradas intermedias.
          </small>
        </div>
      </section>
      <section className="commercial-section">
        <div className="section-heading">
          <div>
            <span className="overline">DESCUBRE ECUADOR</span>
            <h2>Destinos que inspiran</h2>
          </div>
          <button className="link">Ver todos los destinos →</button>
        </div>
        <div className="destination-grid">
          <article
            className="destination large"
            style={{
              backgroundImage: `linear-gradient(0deg,rgba(5,20,40,.75),transparent 65%),url(${cuencaImage})`,
            }}
          >
            <div>
              <strong>Cuenca</strong>
              <span>Historia, arquitectura y cultura</span>
              <small>desde $12,00</small>
            </div>
          </article>
          <article className="destination text-destination">
            <span>RUTA DESTACADA</span>
            <strong>Quito → Loja</strong>
            <p>Viaja de noche y despierta en el sur del país.</p>
            <button onClick={onSearch}>
              Ver 8 salidas <Icon name="arrow" />
            </button>
          </article>
          <article
            className="destination photo-small"
            style={{
              backgroundImage: `linear-gradient(0deg,rgba(5,20,40,.75),transparent),url(${busImage})`,
            }}
          >
            <div>
              <strong>18 cooperativas</strong>
              <span>Comparte una misma ruta, elige mejor.</span>
            </div>
          </article>
        </div>
      </section>
      <section className="trust-row">
        <div>
          <Icon name="shield" />
          <span>
            <b>Compra protegida</b>
            <small>Pagos revisados</small>
          </span>
        </div>
        <div>
          <Icon name="ticket" />
          <span>
            <b>Boleto digital</b>
            <small>Siempre disponible</small>
          </span>
        </div>
        <div>
          <Icon name="wallet" />
          <span>
            <b>Precios claros</b>
            <small>Sin cargos ocultos</small>
          </span>
        </div>
        <div>
          <Icon name="users" />
          <span>
            <b>Soporte local</b>
            <small>Atención en español</small>
          </span>
        </div>
      </section>
    </main>
  );
}

function Progress({ step }: { step: number }) {
  const items = ["Buscar", "Viaje", "Asientos", "Pasajeros", "Pago", "Revisión", "Boleto"];
  return (
    <div className="progress">
      {items.map((x, i) => (
        <div className={i < step ? "done" : i === step ? "current" : ""} key={x}>
          <i>{i < step ? <Icon name="check" size={13} /> : i + 1}</i>
          <span>{x}</span>
        </div>
      ))}
    </div>
  );
}

function Results({ onSelect, onBack }: { onSelect: () => void; onBack: () => void }) {
  return (
    <main className="purchase-content">
      <div className="result-heading">
        <div>
          <button className="back-link" onClick={onBack}>
            ← Modificar búsqueda
          </button>
          <h1>Latacunga → Cuenca</h1>
          <p>Sábado, 15 de noviembre · 1 pasajero · 6 viajes encontrados</p>
        </div>
        <div className="search-summary">
          <Icon name="calendar" /> Programación disponible hasta 30/11/2026
        </div>
      </div>
      <div className="result-layout">
        <aside className="filters panel">
          <h2>Filtrar resultados</h2>
          <SelectField label="Cooperativa" options={["Todas", "Cooperativa Loja", "Panamericana"]} />
          <SelectField label="Horario" options={["Todo el día", "Mañana", "Tarde", "Noche"]} />
          <SelectField label="Tipo de viaje" options={["Todos", "Directo", "Con paradas"]} />
          <SelectField label="Tipo de asiento" options={["Todos", "Normal", "VIP"]} />
          <div className="price-range">
            <span>Precio máximo</span>
            <input type="range" />
            <b>Hasta $28</b>
          </div>
          <Button variant="ghost">Limpiar filtros</Button>
        </aside>
        <section className="results-list">
          <div className="sort-row">
            <span>6 opciones disponibles</span>
            <SelectField label="" options={["Recomendados", "Menor precio", "Salida más próxima"]} />
          </div>
          <TripResult featured onSelect={onSelect} />
          <TripResult onSelect={onSelect} second />
        </section>
      </div>
    </main>
  );
}

function TripResult({
  featured,
  second,
  onSelect,
}: {
  featured?: boolean;
  second?: boolean;
  onSelect: () => void;
}) {
  return (
    <article className={`trip-result ${featured ? "featured" : ""}`}>
      {featured && <span className="recommend">MEJOR OPCIÓN</span>}
      <div className="trip-company">
        <span className="coop-logo small">CL</span>
        <div>
          <strong>{second ? "Panamericana" : "Cooperativa Loja"}</strong>
          <small>
            Unidad {second ? "27" : "18"} · {second ? "AAA-2721" : "LAA-1842"}
          </small>
        </div>
        <span className="rating">★ 4,8</span>
      </div>
      <div className="trip-time">
        <div>
          <strong>{second ? "12:30" : "10:15"}</strong>
          <span>Terminal Latacunga</span>
        </div>
        <div className="duration">
          <span>5 h 45 min</span>
          <i />
          <Badge tone="info">Con 2 paradas</Badge>
        </div>
        <div>
          <strong>{second ? "18:45" : "16:00"}</strong>
          <span>Terminal Cuenca</span>
        </div>
      </div>
      <div className="trip-meta">
        <span>Wi-Fi</span>
        <span>USB</span>
        <span>Baño</span>
        <span>Aire acondicionado</span>
      </div>
      <div className="trip-footer">
        <div>
          <Badge tone="success">{second ? "8" : "14"} asientos disponibles</Badge>
          <small>Tramo Latacunga → Cuenca</small>
        </div>
        <div>
          <span>desde</span>
          <strong>${second ? "20,00" : "18,50"}</strong>
          <small>por persona</small>
        </div>
        <Button onClick={onSelect}>Seleccionar</Button>
      </div>
    </article>
  );
}

function SeatSelection({
  selected,
  setSelected,
  onNext,
}: {
  selected: number;
  setSelected: (n: number) => void;
  onNext: () => void;
}) {
  const [segment, setSegment] = useState("Latacunga → Cuenca");
  const occupied = segment === "Quito → Latacunga" ? [3, 8, 12, 16, 20] : [3, 12, 16, 20];

  return (
    <main className="purchase-content">
      <div className="result-heading">
        <div>
          <h1>Elige tu asiento</h1>
          <p>Cooperativa Loja · Unidad 18 · 15/11/2026, 10:15</p>
        </div>
        <Badge tone="warning">Reserva temporal: 09:42</Badge>
      </div>
      <div className="seat-purchase">
        <section className="panel">
          <div className="segment-demo">
            <div>
              <span>TRAMO SELECCIONADO</span>
              <strong>{segment}</strong>
              <small>El asiento 8 se reutiliza en tramos consecutivos.</small>
            </div>
            <select
              value={segment}
              onChange={(e) => {
                setSegment(e.target.value);
                setSelected(0);
              }}
            >
              <option>Latacunga → Cuenca</option>
              <option>Quito → Latacunga</option>
            </select>
          </div>
          <div className="segment-track">
            <span className="passed">Quito</span>
            <i />
            <span>Latacunga</span>
            <i className="active" />
            <span>Riobamba</span>
            <i className="active" />
            <span>Cuenca</span>
          </div>
          <div className="floor-selector">
            <button className="active">Piso 1</button>
            <button>Piso 2</button>
          </div>
          <SeatMap selected={selected} onSelect={setSelected} occupied={occupied} />
          <div className="seat-legend">
            <span>
              <i className="seat-key normal" />Disponible
            </span>
            <span>
              <i className="seat-key selected" />Seleccionado
            </span>
            <span>
              <i className="seat-key occupied" />Ocupado en tramo
            </span>
            <span>
              <i className="seat-key preferred" />Preferencial
            </span>
          </div>
          {segment === "Quito → Latacunga" && (
            <div className="info-box">
              <Icon name="check" />
              <span>Asiento 8 vendido hasta Latacunga; queda disponible para Latacunga → Cuenca.</span>
            </div>
          )}
        </section>
        <aside className="booking-summary">
          <span className="overline">RESUMEN DE COMPRA</span>
          <h2>Tu viaje</h2>
          <div className="summary-route">
            <strong>
              Latacunga <Icon name="arrow" /> Cuenca
            </strong>
            <span>15 NOV 2026 · 10:15</span>
          </div>
          <dl>
            <div>
              <dt>Pasajeros</dt>
              <dd>1 adulto</dd>
            </div>
            <div>
              <dt>Asiento</dt>
              <dd>{selected ? `Piso 1 · ${selected}` : "Por seleccionar"}</dd>
            </div>
            <div>
              <dt>Tarifa base</dt>
              <dd>$18,50</dd>
            </div>
            <div>
              <dt>Categoría</dt>
              <dd>{selected && selected < 5 ? "VIP +$4,00" : "Normal"}</dd>
            </div>
          </dl>
          <div className="total">
            <span>Total USD</span>
            <strong>${selected && selected < 5 ? "22,50" : "18,50"}</strong>
          </div>
          <Button disabled={!selected} onClick={onNext}>
            Continuar con pasajeros
          </Button>
          <small>La reserva vence si no completas el pago en el plazo configurable.</small>
        </aside>
      </div>
    </main>
  );
}

function PassengerForm({ onNext, seat }: { onNext: () => void; seat: number }) {
  const [category, setCategory] = useState("Persona con discapacidad");
  const [validated, setValidated] = useState(false);

  return (
    <main className="purchase-content narrow">
      <div className="result-heading">
        <div>
          <h1>Datos del pasajero</h1>
          <p>Asocia la información con el asiento {seat}.</p>
        </div>
      </div>
      <div className="form-summary-layout">
        <section className="panel passenger-data">
          <div className="panel-head">
            <div>
              <Badge tone="info">Pasajero 1 · Asiento {seat}</Badge>
              <h2>Información personal</h2>
            </div>
          </div>
          <div className="form-grid">
            <Field label="Nombres" value="María Fernanda" />
            <Field label="Apellidos" value="Torres Hidalgo" />
            <Field label="Cédula" value="1104687291" note="Usada para validar identidad y elegibilidad." />
            <SelectField
              label="Categoría tarifaria"
              value={category}
              onChange={setCategory}
              options={["General", "Menor de edad", "Persona con discapacidad", "Tercera edad"]}
            />
          </div>
          <div className="validation-card">
            <div>
              <Icon name="shield" />
              <span>
                <strong>Validación de descuento</strong>
                <small>La cédula no verifica automáticamente una discapacidad.</small>
              </span>
            </div>
            {validated ? (
              <Badge tone="warning">Requiere revisión documental</Badge>
            ) : (
              <Button variant="secondary" onClick={() => setValidated(true)}>
                Revisar elegibilidad
              </Button>
            )}
          </div>
          {validated && (
            <div className="warning-box">
              <Icon name="warning" />
              <div>
                <strong>Documento adicional requerido</strong>
                <span>
                  Adjunta la acreditación correspondiente. El descuento es demostrativo, configurable y pendiente de validación normativa. No se aplica recargo.
                </span>
              </div>
            </div>
          )}
          <label className="check consent">
            <input type="checkbox" defaultChecked /> Confirmo que los datos corresponden a la persona que viajará.
          </label>
        </section>
        <aside className="booking-summary">
          <span className="overline">TARIFA</span>
          <h2>Detalle</h2>
          <dl>
            <div>
              <dt>Tarifa base</dt>
              <dd>$18,50</dd>
            </div>
            <div>
              <dt>Categoría</dt>
              <dd>{category}</dd>
            </div>
            <div>
              <dt>Descuento demostrativo</dt>
              <dd>-$9,25</dd>
            </div>
          </dl>
          <div className="total">
            <span>Total USD</span>
            <strong>$9,25</strong>
          </div>
          <Button disabled={!validated} onClick={onNext}>
            Continuar al pago
          </Button>
        </aside>
      </div>
    </main>
  );
}

function Payment({
  state,
  setState,
  onNext,
}: {
  state: string;
  setState: (s: "upload" | "review" | "approved") => void;
  onNext: () => void;
}) {
  return (
    <main className="purchase-content narrow">
      <div className="result-heading">
        <div>
          <h1>Pago por transferencia</h1>
          <p>Tu asiento está reservado por 28 minutos.</p>
        </div>
        <Badge tone="warning">Reserva: 27:48</Badge>
      </div>
      <div className="payment-layout">
        <section className="panel">
          <div className="bank-card">
            <span>DATOS BANCARIOS</span>
            <div>
              <small>Banco</small>
              <strong>Banco Pichincha</strong>
            </div>
            <div>
              <small>Cuenta corriente</small>
              <strong>2100246810</strong>
            </div>
            <div>
              <small>Beneficiario</small>
              <strong>Cooperativa Loja Ltda.</strong>
            </div>
            <div>
              <small>Monto exacto</small>
              <strong>$9,25 USD</strong>
            </div>
          </div>
          <div className="upload-zone">
            <Icon name="file" size={34} />
            <strong>
              {state === "upload" ? "Carga tu comprobante" : "comprobante_transferencia.pdf"}
            </strong>
            <span>
              {state === "upload" ? "PDF, JPG o PNG · Máximo 5 MB" : "1,2 MB · Documento demostrativo"}
            </span>
            {state === "upload" ? (
              <Button variant="secondary" onClick={() => setState("review")}>
                Seleccionar archivo
              </Button>
            ) : (
              <Badge tone="success">Archivo listo</Badge>
            )}
          </div>
          <Field label="Referencia de transferencia" placeholder="Ej. 874521" />
          <div className="info-box">
            <Icon name="shield" />
            <span>
              Subir el comprobante no aprueba el pago. Un oficinista validará monto, referencia y titularidad.
            </span>
          </div>
        </section>
        <aside className="booking-summary">
          <span className="overline">POLÍTICA DE PAGO</span>
          <h2>Antes de enviar</h2>
          <ul className="check-list">
            <li>
              <Icon name="check" />El monto debe ser exacto.
            </li>
            <li>
              <Icon name="check" />La referencia debe ser legible.
            </li>
            <li>
              <Icon name="check" />La reserva vence en 30 minutos.
            </li>
            <li>
              <Icon name="check" />Podrás corregir un rechazo válido.
            </li>
          </ul>
          <div className="total">
            <span>Total USD</span>
            <strong>$9,25</strong>
          </div>
          <Button disabled={state === "upload"} onClick={onNext}>
            Enviar a revisión
          </Button>
          <Button variant="ghost">Cambiar método de pago</Button>
        </aside>
      </div>
    </main>
  );
}

function PaymentReview({ onNext }: { onNext: () => void }) {
  const [checked, setChecked] = useState(false);

  return (
    <main className="purchase-content centered">
      <div className={`status-orbit ${checked ? "approved" : ""}`}>
        <Icon name={checked ? "check" : "wallet"} size={36} />
      </div>
      <h1>{checked ? "Pago aprobado" : "Comprobante en revisión"}</h1>
      <p>
        {checked
          ? "Tu boleto fue emitido y ya está disponible."
          : "Recibimos tu comprobante. Normalmente lo revisamos en menos de 20 minutos."}
      </p>
      <div className="review-card">
        <div>
          <span>Solicitud</span>
          <strong>PAY-2026-08421</strong>
        </div>
        <div>
          <span>Monto</span>
          <strong>$9,25</strong>
        </div>
        <div>
          <span>Estado</span>
          <Badge tone={checked ? "success" : "warning"}>{checked ? "Aprobado" : "En revisión"}</Badge>
        </div>
      </div>
      {checked ? (
        <Button onClick={onNext}>Ver boleto digital</Button>
      ) : (
        <Button onClick={() => setChecked(true)}>Consultar estado ahora</Button>
      )}
      <small>Recibirás una notificación dentro de RutaEC y una previsualización por correo.</small>
    </main>
  );
}

function DigitalTicket({ onExit }: { onExit: () => void }) {
  return (
    <main className="purchase-content ticket-page">
      <div className="ticket-success">
        <span>
          <Icon name="check" />
        </span>
        <div>
          <h1>¡Tu viaje está confirmado!</h1>
          <p>Guarda este boleto. También permanecerá en “Mis viajes”.</p>
        </div>
      </div>
      <div className="full-ticket">
        <div className="full-ticket-head">
          <div>
            <span className="coop-logo">CL</span>
            <div>
              <strong>Cooperativa Loja</strong>
              <small>BOLETO DIGITAL · DEMOSTRACIÓN</small>
            </div>
          </div>
          <Badge tone="success">Válido</Badge>
        </div>
        <div className="full-ticket-route">
          <div>
            <span>ORIGEN</span>
            <strong>Latacunga</strong>
            <small>Terminal terrestre</small>
          </div>
          <div className="route-arrow">
            <span>15 NOV 2026</span>
            <i />
            <small>5 h 45 min</small>
          </div>
          <div>
            <span>DESTINO</span>
            <strong>Cuenca</strong>
            <small>Terminal terrestre</small>
          </div>
        </div>
        <div className="full-ticket-details">
          <div>
            <span>PASAJERO</span>
            <strong>María Fernanda Torres</strong>
            <small>Cédula ••••••7291</small>
          </div>
          <div>
            <span>SALIDA</span>
            <strong>10:15</strong>
            <small>Presentarse 30 min antes</small>
          </div>
          <div>
            <span>UNIDAD</span>
            <strong>18 · LAA-1842</strong>
            <small>Piso 1</small>
          </div>
          <div>
            <span>ASIENTO</span>
            <strong>08</strong>
            <small>Preferencial · General</small>
          </div>
          <div>
            <span>TOTAL</span>
            <strong>$9,25</strong>
            <small>Pago aprobado</small>
          </div>
        </div>
        <div className="ticket-code">
          <div className="qr-large">
            <Icon name="qr" size={92} />
          </div>
          <div>
            <span>IDENTIFICADOR</span>
            <strong>REC-8F29-A71</strong>
            <small>QR demostrativo · No válido para viajes reales</small>
          </div>
        </div>
      </div>
      <div className="button-row center">
        <Button variant="secondary" icon="file">
          Descargar boleto
        </Button>
        <Button onClick={onExit}>Comprar otro boleto</Button>
      </div>
    </main>
  );
}
