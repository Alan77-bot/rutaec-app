import type { RouteObject } from "react-router-dom";
import Login from "./pages/Login";
import Registro from "./pages/Registro";
import DemoAccess from "./pages/DemoAccess";

export const usuariosRoutes: RouteObject[] = [
  { path: "/demo", element: <DemoAccess /> },
  { path: "/login", element: <Login /> },
  { path: "/registro", element: <Registro /> },
];