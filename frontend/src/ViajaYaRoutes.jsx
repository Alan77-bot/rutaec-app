
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";

import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import { useApp } from "./context/AppContext";

import Home from "./pages/Home";
import Login from "./modules/usuarios/Login";
import Resultados from "./modules/reservas/Resultados";
import Compra from "./modules/reservas/Compra";
import Boleto from "./modules/boletos/Boleto";
import Historial from "./modules/boletos/Historial";
import PanelOficinista from "./modules/pagos/PanelOficinista";
import PanelCoop from "./modules/cooperativas/PanelCoop";
import PanelAdmin from "./modules/administracion/PanelAdmin";
import AccesoDenegado from "./modules/usuarios/AccesoDenegado";

import RecuperarContrasena from "./modules/usuarios/RecuperarContrasena";
import RestablecerContrasena from "./modules/usuarios/RestablecerContrasena";

function Protegida({ roles, children }) {
  const { sesion, cargando } = useApp();
  const loc = useLocation();

  if (cargando) return <div className="splash" role="status">Comprobando sesión...</div>;

  if (!sesion) {
    return (
      <Navigate
        to="/ingresar"
        replace
        state={{ from: loc.pathname + loc.search }}
      />
    );
  }

  if (!roles.includes(sesion.rol)) {
    return <Navigate to="/acceso-denegado" replace />;
  }

  return children;
}

export default function ViajaYaRoutes() {
  const { aviso, cargando, errorRed, reintentar } = useApp();
  const loc = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [loc.pathname]);

  if (cargando) {
    return <div className="splash" role="status">Cargando...</div>;
  }

  if (errorRed) {
    return (
      <div className="splash">
        <h2>No pudimos conectar con el servidor</h2>
        <p role="alert">{errorRed}</p>
        <button type="button" className="btn btn-oscuro" onClick={reintentar}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <>
      <Navbar />

      <main key={loc.pathname} className="pagina">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/ingresar" element={<Login />} />

          <Route path="/buscar" element={<Resultados />} />
          <Route
              path="/recuperar-contrasena"
              element={<RecuperarContrasena />}
            />

            <Route
              path="/restablecer-contrasena"
              element={<RestablecerContrasena />}
            />
          <Route
            path="/comprar/:viajeId"
            element={
              <Protegida roles={["usuario", "oficinista"]}>
                <Compra />
              </Protegida>
            }
          />

          <Route
            path="/boleto/:id"
            element={
              <Protegida roles={["usuario", "oficinista"]}>
                <Boleto />
              </Protegida>
            }
          />

          <Route
            path="/mis-viajes"
            element={
              <Protegida roles={["usuario"]}>
                <Historial />
              </Protegida>
            }
          />

          <Route
            path="/oficinista"
            element={
              <Protegida roles={["oficinista"]}>
                <PanelOficinista />
              </Protegida>
            }
          />

          <Route
            path="/cooperativa"
            element={
              <Protegida roles={["cooperativa"]}>
                <PanelCoop />
              </Protegida>
            }
          />

          <Route
            path="/admin"
            element={
              <Protegida roles={["admin"]}>
                <PanelAdmin />
              </Protegida>
            }
          />

          <Route path="/acceso-denegado" element={<AccesoDenegado />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {loc.pathname !== "/ingresar" && <Footer />}
      {aviso && <div className="toast" role="status">{aviso}</div>}
    </>
  );
}
