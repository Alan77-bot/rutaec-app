import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Navbar from './ui/Navbar'
import Footer from './ui/Footer'
import { useApp } from './ui/AppContext'
import Home from './public/Home'
import Login from './public/Login'
import Resultados from './public/Resultados'
import Compra from './venta/Compra'
import Boleto from './venta/Boleto'
import Historial from './venta/Historial'
import PanelOficinista from './oficinista/PanelOficinista'
import PanelCoop from './coop/PanelCoop'
import PanelAdmin from './admin/PanelAdmin'

function Protegida({ roles, children }) {
  const { sesion } = useApp()
  const loc = useLocation()
  if (!sesion) return <Navigate to="/ingresar" replace state={{ from: loc.pathname + loc.search }} />
  if (!roles.includes(sesion.rol)) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const { aviso, cargando, errorRed, reintentar } = useApp()
  const loc = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [loc.pathname])

  if (cargando) {
    return (
      <div className="splash" role="status">
        <span className="marca-logo-app grande" />
        <p>Cargando…</p>
      </div>
    )
  }
  if (errorRed) {
    return (
      <div className="splash">
        <span className="marca-logo-app grande" />
        <h2>No pudimos conectar con el servidor</h2>
        <p className="muted">{errorRed}</p>
        <button className="btn btn-oscuro" onClick={reintentar}>Reintentar</button>
      </div>
    )
  }

  return (
    <>
      <Navbar />
      <main key={loc.pathname} className="pagina">
        <Routes location={loc}>
          <Route path="/" element={<Home />} />
          <Route path="/ingresar" element={<Login />} />
          <Route path="/buscar" element={<Resultados />} />
          <Route path="/comprar/:viajeId" element={<Protegida roles={['usuario', 'oficinista']}><Compra /></Protegida>} />
          <Route path="/boleto/:id" element={<Protegida roles={['usuario', 'oficinista']}><Boleto /></Protegida>} />
          <Route path="/mis-viajes" element={<Protegida roles={['usuario']}><Historial /></Protegida>} />
          <Route path="/oficinista" element={<Protegida roles={['oficinista']}><PanelOficinista /></Protegida>} />
          <Route path="/cooperativa" element={<Protegida roles={['cooperativa']}><PanelCoop /></Protegida>} />
          <Route path="/admin" element={<Protegida roles={['admin']}><PanelAdmin /></Protegida>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {loc.pathname !== '/ingresar' && <Footer />}
      {aviso && <div className="toast">{aviso}</div>}
    </>
  )
}
