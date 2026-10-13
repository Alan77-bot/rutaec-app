import type { RouteObject } from "react-router-dom";
import Login from "./pages/Login";
import Registro from "./pages/Registro";

export const usuariosRoutes: RouteObject[] = [
  { path: "/login", element: <Login /> },
  { path: "/registro", element: <Registro /> },
];