import React, { useEffect, useState } from "react";

export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const iconPaths: Record<string, React.ReactNode> = {
  arrow: <path d="m9 18 6-6-6-6M4 12h11" />,
  bell: <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />,
  bus: <><path d="M6 17h12M6 5h12v12H6zM8 2h8v3M8 9h8M8 17v3M16 17v3" /><circle cx="9" cy="14" r="1" /><circle cx="15" cy="14" r="1" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12" /><circle cx="12" cy="12" r="3" /></>,
  file: <><path d="M14 2H6a2 2 0 0 0-2 2v16h16V8Z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></>,
  home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v11h14V10M9 21v-7h6v7" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  qr: <><rect x="3" y="3" width="6" height="6" /><rect x="15" y="3" width="6" height="6" /><rect x="3" y="15" width="6" height="6" /><path d="M15 15h2v2h-2zM19 15h2v6h-6v-2M11 3v4M11 11h4M11 15v6" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  shield: <><path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>,
  ticket: <path d="M3 7h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4Z" />,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
  wallet: <><path d="M3 6h16v14H3z" /><path d="M3 8V4h13v4M15 12h6v5h-6z" /></>,
  warning: <><path d="M12 3 2 21h20Z" /><path d="M12 9v5M12 18h.01" /></>,
};

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg aria-hidden="true" className="icon" width={size} height={size} viewBox="0 0 24 24">
      {iconPaths[name] || iconPaths.more}
    </svg>
  );
}

export function Button({
  children,
  variant = "primary",
  icon,
  onClick,
  disabled,
  type = "button",
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  icon?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button type={type} className={`btn btn-${variant}`} onClick={onClick} disabled={disabled}>
      {icon && <Icon name={icon} size={17} />}
      {children}
    </button>
  );
}

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: Tone }) {
  return (
    <span className={`badge badge-${tone}`}>
      <span className="badge-dot" />
      {children}
    </span>
  );
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  note,
  error,
}: {
  label: string;
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  type?: string;
  note?: string;
  error?: string;
}) {
  return (
    <label className="field">
      {label && <span>{label}</span>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
      />
      {note && <small>{note}</small>}
      {error && (
        <small className="field-error">
          <Icon name="warning" size={14} />
          {error}
        </small>
      )}
    </label>
  );
}

export function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value?: string;
  options: string[];
  onChange?: (v: string) => void;
}) {
  return (
    <label className="field">
      {label && <span>{label}</span>}
      <select value={value} onChange={(e) => onChange?.(e.target.value)}>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="logo">
      <span className="logo-mark">
        <Icon name="bus" size={21} />
      </span>
      {!compact && (
        <span>
          Ruta<b>EC</b>
        </span>
      )}
    </div>
  );
}

const menus: Record<string, { icon: string; label: string }[]> = {
  admin: [
    { icon: "home", label: "Resumen" },
    { icon: "bus", label: "Cooperativas" },
    { icon: "users", label: "Usuarios y roles" },
    { icon: "ticket", label: "Servicios contratados" },
    { icon: "file", label: "Reportes" },
    { icon: "shield", label: "Auditoría" },
  ],
  gerente: [
    { icon: "home", label: "Resumen" },
    { icon: "shield", label: "Mi cooperativa" },
    { icon: "edit", label: "Personalización" },
    { icon: "users", label: "Personal" },
    { icon: "bus", label: "Buses y asientos" },
    { icon: "pin", label: "Frecuencias" },
    { icon: "calendar", label: "Hojas de ruta" },
    { icon: "wallet", label: "Tarifas y ventas" },
  ],
  oficinista: [
    { icon: "home", label: "Resumen" },
    { icon: "plus", label: "Venta rápida" },
    { icon: "wallet", label: "Comprobantes" },
    { icon: "ticket", label: "Ventas" },
    { icon: "users", label: "Pasajeros" },
    { icon: "file", label: "Cierre de caja" },
  ],
  proyecto: [
    { icon: "home", label: "Dashboard de cambios" },
    { icon: "file", label: "Solicitudes" },
    { icon: "calendar", label: "Tablero" },
    { icon: "plus", label: "Nueva solicitud" },
    { icon: "shield", label: "Comité" },
    { icon: "check", label: "Pruebas" },
    { icon: "arrow", label: "Trazabilidad" },
    { icon: "file", label: "Documentación" },
  ],
};

export function AppShell({
  role,
  title,
  subtitle,
  active,
  onActive,
  onExit,
  children,
  cooperative = true,
}: {
  role: "admin" | "gerente" | "oficinista" | "proyecto";
  title: string;
  subtitle?: string;
  active: string;
  onActive: (s: string) => void;
  onExit: () => void;
  children: React.ReactNode;
  cooperative?: boolean;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const names = {
    admin: "Administración general",
    gerente: "Gerencia",
    oficinista: "Ventanilla",
    proyecto: "Gestión del proyecto",
  };
  const selectSection = (section: string) => {
    onActive(section);
    setMobileNavOpen(false);
  };
  useEffect(() => {
    if (!mobileNavOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNavOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [mobileNavOpen]);

  return (
    <div className="app-shell">
      {mobileNavOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="Cerrar menú"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <aside className={`sidebar ${mobileNavOpen ? "mobile-open" : ""}`} aria-label="Navegación principal">
        <div className="sidebar-brand">
          <Logo />
          <button className="sidebar-close" aria-label="Cerrar menú" onClick={() => setMobileNavOpen(false)}>
            <Icon name="close" />
          </button>
        </div>
        <div className="context-card">
          <span>{role === "proyecto" ? "ESPACIO ACADÉMICO" : "CONTEXTO ACTUAL"}</span>
          <strong>{cooperative ? "Cooperativa Loja" : "RutaEC nacional"}</strong>
          <small>{names[role]}</small>
        </div>
        <nav>
          {menus[role]?.map((m) => (
            <button
              key={m.label}
              className={active === m.label ? "active" : ""}
              onClick={() => selectSection(m.label)}
            >
              <Icon name={m.icon} size={18} />
              {m.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-user">
          <span className="avatar">
            {role === "admin" ? "AM" : role === "proyecto" ? "CV" : role === "oficinista" ? "MR" : "JP"}
          </span>
          <div>
            <strong>
              {role === "admin"
                ? "Andrea Mora"
                : role === "proyecto"
                ? "Carla Vélez"
                : role === "oficinista"
                ? "María Ruiz"
                : "Juan Paredes"}
            </strong>
            <small>Ver perfil</small>
          </div>
          <button onClick={onExit}>↗</button>
        </div>
      </aside>
      <div className="shell-main">
        <header className="app-header">
          <div>
            <button
              className="mobile-menu"
              aria-label="Abrir menú"
              aria-expanded={mobileNavOpen}
              onClick={() => setMobileNavOpen(true)}
            >
              <Icon name="menu" />
            </button>
            <span className="breadcrumb">Inicio / {active}</span>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <div className="header-tools">
            <button className="icon-button" aria-label="Notificaciones">
              <Icon name="bell" />
              <i />
            </button>
            <Button
              variant="secondary"
              icon="plus"
              onClick={() => onActive(role === "proyecto" ? "Nueva solicitud" : active)}
            >
              Nueva acción
            </Button>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}

export function Stat({
  label,
  value,
  detail,
  tone = "teal",
  icon = "ticket",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: string;
  icon?: string;
}) {
  return (
    <article className="stat-card">
      <span className={`stat-icon stat-${tone}`}>
        <Icon name={icon} />
      </span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

export function BarChart() {
  const bars = [42, 61, 48, 76, 58, 86, 68, 94, 78, 100, 83, 92];
  return (
    <div className="bar-chart">
      {bars.map((h, i) => (
        <div key={i}>
          <span style={{ height: `${h}%` }} className={i === 9 ? "highlight" : ""} />
          <small>{["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"][i]}</small>
        </div>
      ))}
    </div>
  );
}

export function DataTable({ heads, rows }: { heads: string[]; rows: string[][] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {heads.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j}>
                  {j === r.length - 1 && (c === "Activa" || c === "Publicado" || c === "Aprobado") ? (
                    <Badge tone="success">{c}</Badge>
                  ) : j === r.length - 1 && (c === "Inactiva" || c === "Rechazado") ? (
                    <Badge tone="danger">{c}</Badge>
                  ) : j === r.length - 1 ? (
                    <button className="row-action">
                      <Icon name="more" />
                    </button>
                  ) : (
                    c
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="modal-backdrop">
      <div className={`modal ${wide ? "modal-wide" : ""}`}>
        <div className="modal-head">
          <div>
            <span className="overline">RUTAEC · DEMOSTRACIÓN</span>
            <h2>{title}</h2>
          </div>
          <button onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function SeatMap({
  selected,
  onSelect,
  floor = 1,
  occupied = [],
}: {
  selected: number;
  onSelect: (n: number) => void;
  floor?: number;
  occupied?: number[];
}) {
  const seats = floor === 1 ? Array.from({ length: 28 }, (_, i) => i + 1) : Array.from({ length: 14 }, (_, i) => i + 29);
  return (
    <div className="bus-map">
      <div className="driver">
        CABINA <span>◯</span>
      </div>
      <div className="seats-grid">
        {seats.map((n, i) => (
          <button
            key={n}
            disabled={occupied.includes(n)}
            onClick={() => onSelect(n)}
            className={`${selected === n ? "selected" : ""} ${n < 5 ? "vip" : ""} ${
              n === 8 ? "preferred" : ""
            } ${occupied.includes(n) ? "occupied" : ""} ${i % 4 === 2 ? "aisle" : ""}`}
          >
            {n}
            {n === 8 && <sup>P</sup>}
          </button>
        ))}
      </div>
      <div className="bus-rear">
        <span>BAÑO</span>
        <span>ESCALERA</span>
      </div>
    </div>
  );
}
