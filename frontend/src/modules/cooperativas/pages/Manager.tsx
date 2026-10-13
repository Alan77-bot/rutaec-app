import React, { useState } from "react";
import { busImage } from "../../../assets";
import { AppShell, Badge, Button, DataTable, Field, Icon, SeatMap, SelectField, Stat } from "../../../components/ui";
import type { Tone } from "../../../components/ui";

export default function Manager({ onExit = () => {} }: { onExit?: () => void }) {
  const [active, setActive] = useState("Resumen");

  return (
    <AppShell
      role="gerente"
      title={active === "Resumen" ? "Buenos días, Juan" : active}
      subtitle={
        active === "Resumen"
          ? "Esto ocurre hoy en Cooperativa Loja."
          : "Cooperativa Loja · Gestión autorizada"
      }
      active={active}
      onActive={setActive}
      onExit={onExit}
    >
      {active === "Resumen" && <ManagerDashboard setActive={setActive} />}
      {(active === "Personalización" || active === "Mi cooperativa") && <Customization />}
      {active === "Buses y asientos" && <FleetEditor />}
      {active === "Frecuencias" && <Frequency />}
      {active === "Hojas de ruta" && <Schedule />}
      {!["Resumen", "Personalización", "Mi cooperativa", "Buses y asientos", "Frecuencias", "Hojas de ruta"].includes(
        active
      ) && <GenericManager title={active} />}
    </AppShell>
  );
}

function ManagerDashboard({ setActive }: { setActive: (s: string) => void }) {
  return (
    <>
      <div className="stats-grid">
        <Stat label="Buses activos" value="32" detail="4 en ruta ahora" icon="bus" />
        <Stat label="Viajes del día" value="18" detail="12 publicados · 6 finalizados" tone="blue" icon="calendar" />
        <Stat label="Ocupación promedio" value="78%" detail="+6% vs. semana anterior" tone="amber" icon="users" />
        <Stat label="Ingresos de hoy" value="$ 8.420" detail="96 pagos pendientes" tone="violet" icon="wallet" />
      </div>
      <div className="dashboard-grid">
        <section className="panel span-2">
          <div className="panel-head">
            <div>
              <h2>Operación de hoy</h2>
              <p>Salidas próximas y estado de la flota</p>
            </div>
            <Button variant="secondary" onClick={() => setActive("Hojas de ruta")}>
              Ver programación
            </Button>
          </div>
          <div className="timeline-list">
            {[
              ["07:30", "Loja → Cuenca", "Unidad 18 · LAA-1842", "En curso", "success"],
              ["10:15", "Loja → Quito", "Unidad 24 · LBA-2407", "En embarque", "warning"],
              ["13:00", "Loja → Guayaquil", "Unidad 08 · LAA-0821", "Publicado", "info"],
            ].map((x) => (
              <div className="timeline-row" key={x[0]}>
                <strong>{x[0]}</strong>
                <span className="route-line" />
                <div>
                  <b>{x[1]}</b>
                  <small>{x[2]}</small>
                </div>
                <Badge tone={x[4] as Tone}>{x[3]}</Badge>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Atención requerida</h2>
              <p>4 novedades operativas</p>
            </div>
          </div>
          <div className="alert-list">
            <button>
              <span className="alert-icon danger">
                <Icon name="warning" />
              </span>
              <div>
                <b>Conflicto de horario</b>
                <small>Unidad 12 · 14:00 y 14:30</small>
              </div>
              <Icon name="chevron" />
            </button>
            <button>
              <span className="alert-icon warning">
                <Icon name="bus" />
              </span>
              <div>
                <b>Días de parada</b>
                <small>6 buses sin asignación mañana</small>
              </div>
              <Icon name="chevron" />
            </button>
            <button>
              <span className="alert-icon info">
                <Icon name="wallet" />
              </span>
              <div>
                <b>Pagos pendientes</b>
                <small>96 comprobantes por revisar</small>
              </div>
              <Icon name="chevron" />
            </button>
          </div>
        </section>
      </div>
    </>
  );
}

function Customization() {
  const [name, setName] = useState("Cooperativa Loja");
  const [primary, setPrimary] = useState("#087F8C");
  const [secondary, setSecondary] = useState("#12233F");
  const [preview, setPreview] = useState("Tarjeta de viaje");
  const [saved, setSaved] = useState(false);
  const contrastBad = primary.toLowerCase() === "#f4c95d";

  return (
    <div className="custom-layout">
      <section className="panel">
        <div className="panel-head">
          <div>
            <span className="overline">IDENTIDAD DE MARCA</span>
            <h2>Personalización de mi cooperativa</h2>
            <p>Los cambios se reflejan en los puntos de contacto del pasajero.</p>
          </div>
        </div>
        <div className="logo-upload">
          <div className="coop-logo">CL</div>
          <div>
            <strong>Logotipo de la cooperativa</strong>
            <span>PNG o SVG · Máximo 2 MB</span>
            <Button variant="secondary" icon="plus">
              Cambiar logotipo
            </Button>
          </div>
        </div>
        <Field
          label="Nombre comercial"
          value={name}
          onChange={setName}
          note="Visible en resultados, perfiles y boletos."
        />
        <div className="legal-readonly">
          <div>
            <span>Razón social</span>
            <strong>Cooperativa de Transportes Loja Internacional Ltda.</strong>
          </div>
          <div>
            <span>RUC</span>
            <strong>1190006820001</strong>
          </div>
          <small>
            <Icon name="shield" size={14} /> Solo el administrador general puede editar los datos legales.
          </small>
        </div>
        <div className="color-grid">
          <label className="color-field">
            <span>Color principal</span>
            <div>
              <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} />
              <input value={primary} onChange={(e) => setPrimary(e.target.value)} />
            </div>
          </label>
          <label className="color-field">
            <span>Color secundario</span>
            <div>
              <input type="color" value={secondary} onChange={(e) => setSecondary(e.target.value)} />
              <input value={secondary} onChange={(e) => setSecondary(e.target.value)} />
            </div>
          </label>
        </div>
        <div className="quick-colors">
          <span>Probar ejemplo:</span>
          <button onClick={() => setPrimary("#087F8C")}>Actual</button>
          <button onClick={() => setPrimary("#F4C95D")}>Contraste bajo</button>
        </div>
        {contrastBad && (
          <div className="warning-box">
            <Icon name="warning" />
            <div>
              <strong>Contraste insuficiente</strong>
              <span>
                Este color no garantiza lectura sobre blanco. Sugerencia legible:{" "}
                <button onClick={() => setPrimary("#8A5A00")}>usar #8A5A00</button>.
              </span>
            </div>
          </div>
        )}
        <div className="subsection">
          <h3>Contacto y soporte</h3>
          <div className="form-grid">
            <Field label="Teléfono" value="+593 7 257 7555" />
            <Field label="Correo de soporte" value="ayuda@cooperativaloja.com" />
            <Field label="Facebook" value="@cooperativaloja" />
            <Field label="WhatsApp" value="+593 99 420 1820" />
          </div>
        </div>
        {saved && (
          <div className="success-box">
            <Icon name="check" />
            <span>Identidad actualizada en este prototipo. No implica almacenamiento real.</span>
          </div>
        )}
        <div className="form-actions">
          <Button
            variant="ghost"
            onClick={() => {
              setName("Cooperativa Loja");
              setPrimary("#087F8C");
            }}
          >
            Restablecer cambios
          </Button>
          <Button variant="secondary">Cancelar</Button>
          <Button disabled={contrastBad} onClick={() => setSaved(true)}>
            Guardar cambios
          </Button>
        </div>
      </section>
      <aside className="preview-panel">
        <div className="preview-head">
          <div>
            <span className="overline">VISTA PREVIA EN VIVO</span>
            <h2>Así verán tu marca</h2>
          </div>
          <Badge tone="info">Demostración</Badge>
        </div>
        <div className="segmented">
          {["Perfil público", "Tarjeta de viaje", "Detalle", "Boleto"].map((p) => (
            <button
              className={preview === p ? "active" : ""}
              onClick={() => setPreview(p)}
              key={p}
            >
              {p}
            </button>
          ))}
        </div>
        <div
          className="brand-preview"
          style={{ "--brand": primary, "--brand-dark": secondary } as React.CSSProperties}
        >
          {preview === "Boleto" ? (
            <TicketPreview name={name} />
          ) : preview === "Perfil público" ? (
            <PublicProfile name={name} />
          ) : (
            <TripPreview name={name} detail={preview === "Detalle"} />
          )}
        </div>
        <div className="before-after">
          <div>
            <span>ANTES</span>
            <b>Cooperativa Loja</b>
            <i style={{ background: "#087F8C" }} />
          </div>
          <Icon name="arrow" />
          <div>
            <span>DESPUÉS</span>
            <b>{name}</b>
            <i style={{ background: primary }} />
          </div>
        </div>
      </aside>
    </div>
  );
}

function TripPreview({ name, detail }: { name: string; detail?: boolean }) {
  return (
    <div className="mini-trip">
      {detail && <img src={busImage} alt="Bus de la cooperativa estacionado en una calle" />}
      <div className="mini-brand">
        <span className="coop-logo small">CL</span>
        <div>
          <strong>{name || "Nombre de cooperativa"}</strong>
          <small>Servicio interprovincial</small>
        </div>
        <Badge tone="success">Disponible</Badge>
      </div>
      <div className="mini-route">
        <div>
          <strong>10:15</strong>
          <small>Latacunga</small>
        </div>
        <span>
          <i />5 h 45 min<i />
        </span>
        <div>
          <strong>16:00</strong>
          <small>Cuenca</small>
        </div>
      </div>
      <div className="mini-bottom">
        <span>Wi-Fi · USB · Baño</span>
        <strong>desde $18,50</strong>
      </div>
      <Button>Seleccionar</Button>
    </div>
  );
}

function TicketPreview({ name }: { name: string }) {
  return (
    <div className="mini-ticket">
      <div className="ticket-brand">
        <span className="coop-logo small">CL</span>
        <strong>{name}</strong>
        <Badge tone="success">Válido</Badge>
      </div>
      <div className="ticket-route">
        <div>
          <span>ORIGEN</span>
          <strong>Latacunga</strong>
          <small>15 NOV · 10:15</small>
        </div>
        <Icon name="arrow" />
        <div>
          <span>DESTINO</span>
          <strong>Cuenca</strong>
          <small>Terminal terrestre</small>
        </div>
      </div>
      <div className="ticket-details">
        <div>
          <span>PASAJERO</span>
          <b>María Torres</b>
        </div>
        <div>
          <span>UNIDAD</span>
          <b>18 · LAA-1842</b>
        </div>
        <div>
          <span>PISO / ASIENTO</span>
          <b>1 / 12 VIP</b>
        </div>
      </div>
      <div className="fake-qr">
        <Icon name="qr" size={58} />
        <span>
          REC-8F29-A71<br />QR DEMOSTRATIVO
        </span>
      </div>
    </div>
  );
}

function PublicProfile({ name }: { name: string }) {
  return (
    <div className="public-preview">
      <div className="public-cover" style={{ backgroundImage: `url(${busImage})` }} />
      <span className="coop-logo">CL</span>
      <h3>{name}</h3>
      <p>Conectamos Loja con el Ecuador desde 1961.</p>
      <div>
        <Badge tone="success">32 buses activos</Badge>
        <Badge tone="info">18 destinos</Badge>
      </div>
      <Button>Buscar viajes</Button>
    </div>
  );
}

function FleetEditor() {
  const [floor, setFloor] = useState(1);
  const [selected, setSelected] = useState(8);

  return (
    <div className="editor-layout">
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Editor visual de asientos</h2>
            <p>Unidad 18 · LAA-1842 · Marcopolo Paradiso</p>
          </div>
          <Badge tone="success">Capacidad: 42 / 44</Badge>
        </div>
        <div className="segmented floor-tabs">
          <button className={floor === 1 ? "active" : ""} onClick={() => setFloor(1)}>
            Piso 1 · 28 asientos
          </button>
          <button className={floor === 2 ? "active" : ""} onClick={() => setFloor(2)}>
            Piso 2 · 14 asientos
          </button>
        </div>
        <SeatMap selected={selected} onSelect={setSelected} floor={floor} />
        <div className="seat-legend">
          <span>
            <i className="seat-key normal" />Normal
          </span>
          <span>
            <i className="seat-key vip" />VIP
          </span>
          <span>
            <i className="seat-key preferred" />Preferencial
          </span>
          <span>
            <i className="seat-key blocked" />Bloqueado
          </span>
        </div>
      </section>
      <aside className="panel property-panel">
        <span className="overline">PROPIEDADES</span>
        <h2>Asiento {selected}</h2>
        <SelectField
          label="Categoría comercial"
          options={["Normal", "VIP"]}
          value={selected < 5 ? "VIP" : "Normal"}
        />
        <label className="switch-row">
          <div>
            <strong>Asiento preferencial</strong>
            <span>No modifica el precio automáticamente</span>
          </div>
          <input type="checkbox" defaultChecked={selected === 8} />
        </label>
        <label className="switch-row">
          <div>
            <strong>Espacio accesible</strong>
            <span>Condición de accesibilidad</span>
          </div>
          <input type="checkbox" />
        </label>
        <Field label="Numeración" value={String(selected)} />
        <SelectField
          label="Estado operativo"
          options={["Disponible", "Bloqueado por mantenimiento", "No vendible"]}
        />
        <div className="info-box">
          <Icon name="info" />
          <span>La categoría comercial y la accesibilidad son condiciones independientes.</span>
        </div>
        <Button>Aplicar cambios</Button>
        <Button variant="secondary">Previsualizar como pasajero</Button>
      </aside>
    </div>
  );
}

function Frequency() {
  return (
    <div className="dashboard-grid">
      <section className="panel span-2">
        <div className="panel-head">
          <div>
            <h2>Frecuencias autorizadas</h2>
            <p>La plataforma registra autorizaciones; no concede permisos oficiales.</p>
          </div>
          <Button icon="plus">Registrar frecuencia</Button>
        </div>
        <DataTable
          heads={["Código", "Recorrido", "Salida", "Resolución", "Vigencia", "Estado"]}
          rows={[
            ["FREC-UIO-CUE-01", "Quito → Cuenca", "08:00", "ANT-2024-0842", "31/12/2026", "Activa"],
            ["FREC-CUE-UIO-02", "Cuenca → Quito", "21:30", "ANT-2024-0842", "31/12/2026", "Activa"],
            ["FREC-LOJ-GYE-03", "Loja → Guayaquil", "13:00", "ANT-2021-0418", "30/06/2025", "Inactiva"],
          ]}
        />
        <div className="route-editor">
          <span className="overline">PARADAS ORDENADAS · FREC-UIO-CUE-01</span>
          <div className="route-track">
            {["Quito", "Latacunga", "Riobamba", "Cuenca"].map((x, i) => (
              <div key={x}>
                <i>{i + 1}</i>
                <strong>{x}</strong>
                <small>
                  {["08:00 · Embarque", "09:45 · Ambos", "12:10 · Ambos", "16:00 · Desembarque"][i]}
                </small>
              </div>
            ))}
          </div>
          <div className="route-actions">
            <Badge tone="info">Viaje con paradas</Badge>
            <Button variant="secondary" icon="plus">
              Agregar parada
            </Button>
          </div>
        </div>
      </section>
      <aside className="panel">
        <h2>Documento de respaldo</h2>
        <div className="document-card">
          <Icon name="file" size={36} />
          <strong>Resolución ANT-2024-0842</strong>
          <span>PDF · 2,4 MB · Documento demostrativo</span>
          <Button variant="secondary" icon="eye">
            Ver documento
          </Button>
        </div>
        <div className="subsection">
          <h3>Diferencias clave</h3>
          <dl className="definition-list">
            <div>
              <dt>Ruta</dt>
              <dd>El recorrido físico.</dd>
            </div>
            <div>
              <dt>Frecuencia</dt>
              <dd>Ruta y horario autorizados.</dd>
            </div>
            <div>
              <dt>Viaje programado</dt>
              <dd>Ejecución con fecha, bus y personal.</dd>
            </div>
          </dl>
        </div>
      </aside>
    </div>
  );
}

function Schedule() {
  const [published, setPublished] = useState(false);

  return (
    <>
      <div className="notice-banner warning-notice">
        <Icon name="calendar" />
        <div>
          <strong>Programación disponible hasta el 30/11/2026</strong>
          <span>Las fechas posteriores no están habilitadas para venta.</span>
        </div>
      </div>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Hoja de ruta · 15/11/2026</h2>
            <p>Grupo: Larga distancia · Propuesta automática revisable</p>
          </div>
          <div className="button-row">
            <Button variant="secondary">Guardar borrador</Button>
            <Button onClick={() => setPublished(true)}>
              {published ? "Programación publicada" : "Publicar programación"}
            </Button>
          </div>
        </div>
        {published && (
          <div className="success-box">
            <Icon name="check" />
            <span>6 viajes publicados. Ya están disponibles para venta.</span>
          </div>
        )}
        <DataTable
          heads={["Hora", "Frecuencia", "Unidad", "Personal", "Llegada estimada", "Disponibilidad", "Estado"]}
          rows={[
            ["07:30", "Loja → Cuenca", "18 · LAA-1842", "Luis Rojas", "15/11 · 11:20", "12 / 42", "Publicado"],
            ["13:00", "Loja → Guayaquil", "08 · LAA-0821", "Pedro Jara", "15/11 · 21:15", "26 / 44", "Publicado"],
            ["21:30", "Cuenca → Quito", "24 · LBA-2407", "Raúl Tello", "16/11 · 06:15", "35 / 42", "Borrador"],
          ]}
        />
        <div className="conflict-grid">
          <div className="warning-box">
            <Icon name="warning" />
            <div>
              <strong>Conflicto de horario</strong>
              <span>El chofer Luis Rojas tiene viajes superpuestos a las 14:00.</span>
            </div>
            <Button variant="secondary">Resolver</Button>
          </div>
          <div className="stop-day">
            <span>
              <Icon name="bus" />Día de parada
            </span>
            <strong>6 buses</strong>
            <small>Sin asignación; no están en mantenimiento.</small>
          </div>
          <div className="stop-day maintenance">
            <span>
              <Icon name="warning" />Mantenimiento
            </span>
            <strong>2 buses</strong>
            <small>No disponibles para programación.</small>
          </div>
        </div>
      </section>
    </>
  );
}

function GenericManager({ title }: { title: string }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          <p>Gestión exclusiva de Cooperativa Loja.</p>
        </div>
        <Button icon="plus">Crear registro</Button>
      </div>
      <div className="filter-row">
        <Field label="" placeholder="Buscar registros" />
        <SelectField label="" options={["Todos los estados", "Activo", "Inactivo"]} />
        <Button variant="secondary">Aplicar filtros</Button>
      </div>
      <DataTable
        heads={["Nombre", "Tipo", "Responsable", "Última actualización", "Estado"]}
        rows={[
          ["Larga distancia", "Asiento numerado", "Juan Paredes", "14/11/2026", "Activo"],
          ["Cantonales", "Asiento numerado", "María Ruiz", "12/11/2026", "Activo"],
          ["Locales / rancheras", "Por capacidad", "Juan Paredes", "08/11/2026", "Inactivo"],
        ]}
      />
    </section>
  );
}
