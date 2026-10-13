import React, { useState } from "react";
import { heroImage } from "../../../assets";
import { Badge, Button, Field, Icon as UiIcon, Logo, SelectField } from "../../../components/ui";
import type { Role } from "../../../types";

const demoAccounts = [
  { label: "Pasajero", role: "pasajero", email: "pasajero@rutaec.ec" },
  { label: "Gerente de cooperativa", role: "gerente", email: "gerencia@rutaec.ec" },
  { label: "Oficinista", role: "oficinista", email: "ventanilla@rutaec.ec" },
  { label: "Controlador del bus", role: "controlador", email: "control@rutaec.ec" },
  { label: "Administrador general", role: "admin", email: "admin@rutaec.ec" },
  { label: "Gestión académica", role: "proyecto", email: "proyecto@rutaec.ec" },
] as const;

export function Login({ setRole = () => {} }: { setRole?: (r: Role) => void }) {
  const [accountLabel, setAccountLabel] = useState<string>(demoAccounts[0].label);
  const [email, setEmail] = useState<string>(demoAccounts[0].email);
  const [password, setPassword] = useState("demo2025");
  const [error, setError] = useState("");

  const selectAccount = (label: string) => {
    const account = demoAccounts.find((item) => item.label === label) ?? demoAccounts[0];
    setAccountLabel(account.label);
    setEmail(account.email);
    setPassword("demo2025");
    setError("");
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const account = demoAccounts.find((item) => item.label === accountLabel);
    if (!account || email.trim().toLowerCase() !== account.email || password !== "demo2025") {
      setError("Las credenciales no coinciden con el perfil seleccionado.");
      return;
    }
    setRole(account.role as Role);
  };

  return (
    <main className="login-page">
      <section
        className="login-photo"
        style={{
          backgroundImage: `linear-gradient(180deg,rgba(18,35,63,.12),rgba(18,35,63,.9)),url(${heroImage})`,
        }}
      >
        <Logo />
        <div>
          <Badge tone="info">Plataforma nacional</Badge>
          <h1>Tu próximo destino empieza aquí.</h1>
          <p>Compra pasajes y gestiona tus viajes de manera simple y segura.</p>
        </div>
        <small>Ecuador · Sistema de Transporte Interprovincial</small>
      </section>
      <section className="login-form">
        <button className="back-link" onClick={() => setRole("demo")}>
          ← Volver a la demostración
        </button>
        <form className="login-box" onSubmit={submit}>
          <span className="overline">BIENVENIDO A RUTAEC</span>
          <h2>Inicia sesión</h2>
          <p>Selecciona un perfil de demostración para ingresar.</p>
          <SelectField
            label="Perfil de acceso"
            value={accountLabel}
            options={demoAccounts.map((account) => account.label)}
            onChange={selectAccount}
          />
          <div className="demo-credentials">
            <UiIcon name="shield" />
            <div>
              <strong>Credenciales de demostración</strong>
              <span>
                El correo cambia según el perfil. Contraseña para todos: <b>demo2025</b>
              </span>
            </div>
          </div>
          <Field
            label="Correo electrónico"
            value={email}
            onChange={setEmail}
            placeholder="nombre@correo.com"
            error={error || undefined}
          />
          <Field
            label="Contraseña"
            value={password}
            onChange={setPassword}
            type="password"
            placeholder="••••••••"
          />
          <div className="form-row form-between">
            <label className="check">
              <input type="checkbox" /> Recordarme
            </label>
            <button type="button" className="link">¿Olvidaste tu contraseña?</button>
          </div>
          <Button type="submit">Ingresar de forma segura</Button>
          <div className="divider">
            <span>o</span>
          </div>
          <Button variant="secondary" onClick={() => setRole("pasajero")}>
            Crear cuenta de pasajero
          </Button>
          <p className="legal">
            Al continuar aceptas los términos de uso y la política de privacidad.
          </p>
        </form>
      </section>
    </main>
  );
}

export default Login;