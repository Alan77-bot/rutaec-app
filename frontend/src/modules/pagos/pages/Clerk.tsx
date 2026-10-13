import { useState } from "react";
import { AppShell, Button, DataTable, Icon, Stat } from "../../../components/ui";

export default function Clerk({ onExit = () => {} }: { onExit?: () => void }) {
  const [active, setActive] = useState("Comprobantes");
  const [decision, setDecision] = useState<"pending" | "approved" | "rejected">("pending");

  return (
    <AppShell
      role="oficinista"
      title={active}
      subtitle="Cooperativa Loja · Acceso limitado a tu organización"
      active={active}
      onActive={setActive}
      onExit={onExit}
    >
      {active === "Comprobantes" ? (
        <div className="proof-layout">
          <section className="panel proof-file">
            <div className="panel-head">
              <div>
                <h2>Comprobante PAY-2026-08421</h2>
                <p>Recibido el 14/11/2026 · 18:42</p>
              </div>
              <Button variant="secondary" icon="file">
                Abrir original
              </Button>
            </div>
            <div className="fake-proof">
              <span>BANCO PICHINCHA</span>
              <h3>Transferencia realizada</h3>
              <div>
                <small>Valor</small>
                <strong>$ 9,25</strong>
              </div>
              <dl>
                <dt>Desde</dt>
                <dd>María Fernanda Torres</dd>
                <dt>Hacia</dt>
                <dd>Cooperativa Loja Ltda.</dd>
                <dt>Referencia</dt>
                <dd>874521</dd>
                <dt>Fecha</dt>
                <dd>14/11/2026 · 18:38</dd>
              </dl>
              <small>DOCUMENTO DEMOSTRATIVO · SIN VALIDEZ</small>
            </div>
          </section>
          <aside className="panel review-side">
            <span className="overline">REVISIÓN DE PAGO</span>
            <h2>Datos de la compra</h2>
            <dl className="review-data">
              <div>
                <dt>Monto esperado</dt>
                <dd>$9,25</dd>
              </div>
              <div>
                <dt>Monto comprobante</dt>
                <dd className="match">
                  $9,25 <Icon name="check" />
                </dd>
              </div>
              <div>
                <dt>Referencia</dt>
                <dd>874521</dd>
              </div>
              <div>
                <dt>Pasajero</dt>
                <dd>María Torres</dd>
              </div>
              <div>
                <dt>Tramo</dt>
                <dd>Latacunga → Cuenca</dd>
              </div>
              <div>
                <dt>Asiento</dt>
                <dd>08 · Piso 1</dd>
              </div>
            </dl>
            {decision !== "pending" && (
              <div className={decision === "approved" ? "success-box" : "warning-box"}>
                <Icon name={decision === "approved" ? "check" : "warning"} />
                <span>
                  {decision === "approved"
                    ? "Pago aprobado. Boleto REC-8F29-A71 emitido."
                    : "Pago rechazado: comprobante ilegible. El pasajero puede corregirlo."}
                </span>
              </div>
            )}
            <div className="decision-actions">
              <Button variant="danger" onClick={() => setDecision("rejected")}>
                Rechazar con motivo
              </Button>
              <Button onClick={() => setDecision("approved")}>
                Aprobar y emitir
              </Button>
            </div>
          </aside>
        </div>
      ) : (
        <ClerkGeneric active={active} />
      )}
    </AppShell>
  );
}

function ClerkGeneric({ active }: { active: string }) {
  return (
    <>
      <div className="stats-grid">
        <Stat label="Ventas del día" value="$ 2.840" detail="142 transacciones" />
        <Stat label="Boletos emitidos" value="138" detail="97% aprobados" tone="blue" />
        <Stat label="Pagos pendientes" value="16" detail="Requieren revisión" tone="amber" />
        <Stat label="Próximas salidas" value="7" detail="En las próximas 3 h" tone="violet" icon="bus" />
      </div>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>{active}</h2>
            <p>Venta rápida de boletos y consulta de pasajeros.</p>
          </div>
          <Button icon="plus">Nueva venta</Button>
        </div>
        <DataTable
          heads={["Código", "Pasajero", "Tramo", "Asiento", "Monto", "Estado"]}
          rows={[
            ["REC-8F29-A71", "María Torres", "Latacunga → Cuenca", "08", "$9,25", "Aprobado"],
            ["REC-4K18-B22", "Luis Jaramillo", "Loja → Quito", "12", "$24,00", "Pendiente"],
            ["REC-9C55-X82", "Ana Mora", "Cuenca → Quito", "21", "$22,50", "Aprobado"],
          ]}
        />
      </section>
    </>
  );
}
