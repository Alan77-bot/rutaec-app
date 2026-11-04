import MisReservas from "./modules/reservas/MisReservas";
import Descuentos from "./modules/reservas/Descuentos";
import DetalleReserva from "./modules/reservas/DetalleReserva";

import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";

import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import CancelacionViajes from "./modules/horarios/CancelacionViajes";
import { useApp } from "./context/AppContext";

import Home from "./pages/Home";
import ReporteOperativo from './modules/pagos/ReporteOperativo';
import Login from "./modules/usuarios/Login";
import Perfil from "./modules/usuarios/Perfil";
import Resultados from "./modules/reservas/Resultados";
import Compra from "./modules/reservas/Compra";
import Boleto from "./modules/boletos/Boleto";
import Historial from "./modules/boletos/Historial";
import PanelOficinista from "./modules/pagos/PanelOficinista";
import PresentarPago from "./modules/pagos/PresentarPago";
import PanelCoop from "./modules/cooperativas/PanelCoop";
import Revisiones from "./modules/pagos/Revisiones";
import Incidencias from "./modules/pagos/Incidencias";
import PanelAdmin from "./modules/administracion/PanelAdmin";
import AccesoDenegado from "./modules/usuarios/AccesoDenegado";
import Rutas from "./modules/rutas/Rutas";
import Frecuencias from "./modules/horarios/Frecuencias";
import Viajes from "./modules/horarios/Viajes";

import RecuperarContrasena from "./modules/usuarios/RecuperarContrasena";
import RestablecerContrasena from "./modules/usuarios/RestablecerContrasena";
import { esPersonal, inicioPorRol } from './data/acceso';
import SelectorCooperativa from './components/SelectorCooperativa';
import CorreoLocal from './modules/usuarios/CorreoLocal';

function Inicio() {
  const { sesion } = useApp();
  return esPersonal(sesion?.rol) ? <Navigate to={inicioPorRol(sesion.rol)} replace /> : <Home />;
}

function BusquedaPermitida() {
  const { sesion } = useApp();
  return ['admin', 'cooperativa'].includes(sesion?.rol) ? <Navigate to={inicioPorRol(sesion.rol)} replace /> : <Resultados />;
}

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
  const { aviso, cargando, errorRed, reintentar, sesion } = useApp();
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
      {!esPersonal(sesion?.rol) && ['/', '/buscar'].includes(loc.pathname) && <SelectorCooperativa />}

      <main key={loc.pathname} className="pagina">
        <Routes>
          <Route path="/reporte-operativo" element={<Protegida roles={["oficinista","cooperativa","admin"]}><ReporteOperativo /></Protegida>} />
          <Route path="/" element={<Inicio />} />
          <Route path="/ingresar" element={<Login />} />
          <Route path="/correo-local" element={<CorreoLocal />} />
          <Route path="/perfil" element={<Protegida roles={["admin", "cooperativa", "oficinista", "usuario"]}><Perfil /></Protegida>} />

          <Route path="/buscar" element={<BusquedaPermitida />} />
          <Route path="/descuentos" element={<Protegida roles={["usuario"]}><Descuentos /></Protegida>} />
          <Route path="/mis-reservas" element={<Protegida roles={["usuario", "oficinista"]}><MisReservas /></Protegida>} />
          <Route path="/reserva/:id" element={<Protegida roles={["usuario", "oficinista"]}><DetalleReserva /></Protegida>} />
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

          <Route path="/pagar/:compraId" element={<Protegida roles={["usuario", "oficinista"]}><PresentarPago /></Protegida>} />

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

          <Route
            path="/rutas"
            element={
              <Protegida roles={["admin", "cooperativa"]}>
                <Rutas />
              </Protegida>
            }
          />

          <Route path="/incidencias" element={<Protegida roles={["usuario", "oficinista", "admin"]}><Incidencias /></Protegida>} />
          <Route path="/revisiones" element={<Protegida roles={["oficinista", "cooperativa", "admin"]}><Revisiones /></Protegida>} />

          <Route
            path="/frecuencias"
            element={
              <Protegida roles={["admin", "cooperativa"]}>
                <Frecuencias />
              </Protegida>
            }
          />

          <Route
            path="/programacion"
            element={
              <Protegida roles={["admin", "cooperativa"]}>
                <Viajes />
              </Protegida>
            }
          />

          <Route path="/acceso-denegado" element={<AccesoDenegado />} />

          <Route path="/cancelacion-viajes" element={<Protegida roles={["admin", "cooperativa"]}><CancelacionViajes /></Protegida>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {loc.pathname !== "/ingresar" && <Footer />}
      {aviso && <div className="toast" role="status">{aviso}</div>}
    </>
  );
}
