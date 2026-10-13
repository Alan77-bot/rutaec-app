import { useState } from "react";
import { AppShell, Button, DataTable, Icon, Stat } from "../../../components/ui";

export default function ProjectChanges({ onExit = () => {} }: { onExit?: () => void }) {
  const [active, setActive] = useState("Dashboard de cambios");

  return (
    <AppShell
      role="proyecto"
      cooperative={false}
      title={active}
      subtitle="Espacio Académico · Simulación de Control de Cambios y Comité (CCB)"
      active={active}
      onActive={setActive}
      onExit={onExit}
    >
      <div className="academic-banner">
        <Icon name="shield" />
        <div>
          <strong>Manejo y Configuración de Software (UTA)</strong>
          <span>
            Simulación del Comité de Control de Cambios (CCB), peticiones RFC y auditoría de configuración.
          </span>
        </div>
      </div>

      <div className="change-progress">
        <div className="active">
          <i>1</i>
          <span>Solicitud (RFC)</span>
        </div>
        <div className="active">
          <i>2</i>
          <span>Evaluación de Impacto</span>
        </div>
        <div className="active">
          <i>3</i>
          <span>Aprobación CCB</span>
        </div>
        <div>
          <i>4</i>
          <span>Rama & PR</span>
        </div>
        <div>
          <i>5</i>
          <span>Auditoría & Cierre</span>
        </div>
      </div>

      <div className="stats-grid change-stats">
        <Stat label="Peticiones RFC" value="8" detail="3 en curso · 5 cerradas" tone="blue" icon="file" />
        <Stat label="Aprobadas por CCB" value="6" detail="75% tasa de aprobación" tone="teal" icon="check" />
        <Stat label="Rechazadas" value="2" detail="Sin impacto justificado" tone="amber" icon="warning" />
        <Stat label="Versión en línea base" value="v0.1.0" detail="Release estable" tone="violet" icon="shield" />
      </div>

      <div className="change-layout">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Registro de Peticiones de Cambio (RFC)</h2>
              <p>Trazabilidad entre Jira Service Management, ramas de Git y Pull Requests</p>
            </div>
            <Button icon="plus">Nueva solicitud</Button>
          </div>
          <DataTable
            heads={["ID Jira", "Tipo", "Descripción", "Solicitante", "Impacto", "Estado"]}
            rows={[
              ["RFC-01", "Mejora", "Validación estricta de cédula ecuatoriana", "I4 (Cliente)", "Medio", "Aprobado"],
              ["RFC-02", "Regla Negocio", "Ampliar tiempo de reserva a 30 minutos", "I5 (Oficina)", "Bajo", "Aprobado"],
              ["RFC-03", "Defecto", "Superposición de buses en hoja de ruta", "I3 (Frecuencias)", "Alto", "Aprobado"],
              ["RFC-04", "Funcional", "Pasarela de tarjeta en producción", "I5 (Pagos)", "Crítico", "Rechazado"],
            ]}
          />

          <div className="trace-chain">
            <strong>Cadena de trazabilidad:</strong>
            <span>Jira RFC-01</span>
            <Icon name="arrow" size={12} />
            <span>Rama feature/01-cedula</span>
            <Icon name="arrow" size={12} />
            <span>Commit 8a2f1c</span>
            <Icon name="arrow" size={12} />
            <span>PR #14 (2 aprobaciones)</span>
            <Icon name="arrow" size={12} />
            <span>Release v0.1.0</span>
          </div>
        </section>

        <aside className="panel committee">
          <span className="overline">GOBERNANZA</span>
          <h2>Comité de Cambios (CCB)</h2>
          <div className="committee-member">
            <span className="avatar">I1</span>
            <div>
              <strong>Integrante 1 (Jefe)</strong>
              <small>Líder del CCB · Aprobador técnico</small>
            </div>
            <Icon name="check" size={16} />
          </div>
          <div className="committee-member">
            <span className="avatar">I6</span>
            <div>
              <strong>Integrante 6 (Integrador)</strong>
              <small>Auditor de GCS · Verificador de PR</small>
            </div>
            <Icon name="check" size={16} />
          </div>

          <div className="rule-box">
            <strong>Regla de aprobación obligatoria</strong>
            <span>
              Ningún cambio se fusiona en <code>develop</code> sin aprobación del CCB y 2 revisores independientes en GitHub.
            </span>
          </div>

          <Button variant="secondary" icon="file">
            Ver acta de auditoría
          </Button>

          <div className="integration-note">
            <span>AUDITORÍA EN VIVO</span>
            <strong>Jira Service Management</strong>
            <small>Dashboard sincronizado con GitHub</small>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
