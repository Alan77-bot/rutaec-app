import { useRoutes } from "react-router-dom";

import Home from "../pages/Home";
import NoEncontrada from "../pages/NoEncontrada";

import { usuariosRoutes } from "../modules/usuarios/usuarios.routes";
import { cooperativasRoutes } from "../modules/cooperativas/cooperativas.routes";
import { busesRoutes } from "../modules/buses/buses.routes";
import { horariosRoutes } from "../modules/horarios/horarios.routes";
import { reservasRoutes } from "../modules/reservas/reservas.routes";
import { pagosRoutes } from "../modules/pagos/pagos.routes";
import { boletosRoutes } from "../modules/boletos/boletos.routes";
import { choferRoutes } from "../modules/chofer/chofer.routes";
import { administracionRoutes } from "../modules/administracion/administracion.routes";

export default function AppRoutes() {
  return useRoutes([
    { path: "/", element: <Home /> },
    ...usuariosRoutes,
    ...cooperativasRoutes,
    ...busesRoutes,
    ...horariosRoutes,
    ...reservasRoutes,
    ...pagosRoutes,
    ...boletosRoutes,
    ...choferRoutes,
    ...administracionRoutes,
    { path: "*", element: <NoEncontrada /> },
  ]);
}