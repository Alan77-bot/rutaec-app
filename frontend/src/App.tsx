import { useState } from "react";
import type { Role } from "./types";
import DemoAccess from "./modules/usuarios/pages/DemoAccess";
import Login from "./modules/usuarios/pages/Login";
import Passenger from "./modules/reservas/pages/Passenger";
import Manager from "./modules/cooperativas/pages/Manager";
import Clerk from "./modules/pagos/pages/Clerk";
import Controller from "./modules/chofer/pages/Controller";
import Admin from "./modules/administracion/pages/Admin";
import ProjectChanges from "./modules/administracion/pages/ProjectChanges";

export default function App() {
  const [currentRole, setCurrentRole] = useState<Role>("demo");

  const handleExit = () => setCurrentRole("demo");

  return (
    <>
      {currentRole === "demo" && <DemoAccess setRole={setCurrentRole} />}
      {currentRole === "login" && <Login setRole={setCurrentRole} />}
      {currentRole === "pasajero" && <Passenger onExit={handleExit} />}
      {currentRole === "gerente" && <Manager onExit={handleExit} />}
      {currentRole === "oficinista" && <Clerk onExit={handleExit} />}
      {currentRole === "controlador" && <Controller onExit={handleExit} />}
      {currentRole === "admin" && <Admin onExit={handleExit} />}
      {currentRole === "proyecto" && <ProjectChanges onExit={handleExit} />}
    </>
  );
}