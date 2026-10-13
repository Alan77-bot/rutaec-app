import { useState } from "react";
import { AppShell, BarChart, Badge, Button, DataTable, Field, Icon, Modal, SelectField, Stat } from "../../../components/ui";

export default function Admin({ onExit = () => {} }: { onExit?: () => void }) {
  const [active, setActive] = useState("Resumen");
  const [modal, setModal] = useState(false);
  const [created, setCreated] = useState(false);

  const cooperatives = [
    ["Cooperativa Loja", "1190006820001", "Juan Paredes", "Plan Empresa", "Activa"],
    ["Transportes Ecuador", "1790041123001", "Diana Castillo", "Plan Empresa", "Activa"],
    ["Panamericana", "1790380055001", "Carlos Mena", "Plan Profesional", "Activa"],
    ["Unión Cariamanga", "1190019288001", "María Ojeda", "Plan Profesional", "Inactiva"],
  ];

  return (
    <AppShell
      role="admin"
      cooperative={false}
      title={active === "Resumen" ? "Resumen nacional" : active}
      subtitle="Vista consolidada de la operación de RutaEC"
      active={active}
      onActive={setActive}
      onExit={onExit}
    >
      {active === "Resumen" ? (
        <>
          <div className="notice-banner">
            <Icon name="shield" />
            <div>
              <strong>Operación estable</strong>
              <span>Todos los servicios críticos están funcionando con normalidad.</span>
            </div>
            <small>Actualizado 10:42</small>
          </div>
          <div className="stats-grid">
            <Stat label="Cooperativas activas" value="24" detail="+2 este mes" icon="bus" />
            <Stat label="Viajes programados" value="1.284" detail="Próximos 30 días" tone="blue" icon="calendar" />
            <Stat label="Boletos vendidos" value="18.642" detail="+12,4% vs. período anterior" tone="amber" />
            <Stat label="Ventas del período" value="$ 284.320" detail="Octubre 2026" tone="violet" icon="wallet" />
          </div>
          <div className="dashboard-grid">
            <section className="panel span-2">
              <div className="panel-head">
                <div>
                  <h2>Ventas mensuales</h2>
                  <p>Ingresos consolidados de todas las cooperativas</p>
                </div>
                <SelectField label="" options={["2026", "2025"]} />
              </div>
              <div className="chart-total">
                <strong>$ 284.320</strong>
                <Badge tone="success">↑ 12,4%</Badge>
              </div>
              <BarChart />
            </section>
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>Usuarios por rol</h2>
                  <p>1.842 usuarios activos</p>
                </div>
              </div>
              <div className="donut-wrap">
                <div className="donut">
                  <span>
                    1.842<small>total</small>
                  </span>
                </div>
                <ul className="legend">
                  <li>
                    <i className="dot teal" />
                    Pasajeros <b>1.524</b>
                  </li>
                  <li>
                    <i className="dot blue" />
                    Oficinistas <b>146</b>
                  </li>
                  <li>
                    <i className="dot amber" />
                    Controladores <b>112</b>
                  </li>
                  <li>
                    <i className="dot navy" />
                    Gerentes <b>36</b>
                  </li>
                </ul>
              </div>
            </section>
          </div>
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>Cooperativas</h2>
                <p>Administración legal, servicios y cuentas gerenciales</p>
              </div>
              <Button icon="plus" onClick={() => setModal(true)}>
                Crear cooperativa
              </Button>
            </div>
            <DataTable
              heads={["Cooperativa", "RUC", "Gerente asignado", "Servicio", "Estado", ""]}
              rows={cooperatives}
            />
          </section>
        </>
      ) : (
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>{active}</h2>
              <p>Consulta, filtra y administra los registros autorizados.</p>
            </div>
            <Button icon="plus" onClick={() => setModal(true)}>
              Crear registro
            </Button>
          </div>
          <div className="filter-row">
            <Field label="" placeholder="Buscar por nombre, RUC o responsable" />
            <SelectField label="" options={["Todos los estados", "Activa", "Inactiva"]} />
            <Button variant="secondary">Filtrar</Button>
          </div>
          <DataTable
            heads={["Cooperativa", "RUC", "Gerente asignado", "Servicio", "Estado", ""]}
            rows={cooperatives}
          />
        </section>
      )}

      {modal && (
        <Modal title="Crear cooperativa y cuenta gerente" onClose={() => setModal(false)}>
          <div className="form-grid">
            <Field label="Nombre comercial" placeholder="Ej. Expreso Andino" />
            <Field label="Razón social" placeholder="Razón social registrada" />
            <Field label="RUC" placeholder="13 dígitos" />
            <Field label="Teléfono" placeholder="+593 00 000 0000" />
            <Field label="Correo institucional" placeholder="contacto@cooperativa.ec" />
            <SelectField label="Servicio contratado" options={["Plan Empresa", "Plan Profesional"]} />
          </div>
          <div className="subsection">
            <h3>Cuenta del gerente</h3>
            <div className="form-grid">
              <Field label="Nombres y apellidos" placeholder="Responsable legal" />
              <Field label="Correo de acceso" placeholder="gerencia@cooperativa.ec" />
            </div>
          </div>
          {created && (
            <div className="success-box">
              <Icon name="check" />
              <span>Cooperativa creada y gerente vinculado correctamente.</span>
            </div>
          )}
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setModal(false)}>
              Cancelar
            </Button>
            <Button onClick={() => setCreated(true)}>Crear y vincular gerente</Button>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}
