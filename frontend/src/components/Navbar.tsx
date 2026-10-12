import { NavLink } from "react-router-dom";

export default function Navbar() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    isActive ? "font-semibold underline" : "hover:underline";

  return (
    <nav className="flex items-center justify-between bg-blue-900 px-6 py-4 text-white">
      <NavLink to="/" className="text-xl font-bold">
        RutaEC
      </NavLink>

      <div className="flex gap-6">
        <NavLink to="/" end className={linkClass}>
          Inicio
        </NavLink>

        <NavLink to="/login" className={linkClass}>
          Ingresar
        </NavLink>

        <NavLink to="/registro" className={linkClass}>
          Registrarse
        </NavLink>
      </div>
    </nav>
  );
}