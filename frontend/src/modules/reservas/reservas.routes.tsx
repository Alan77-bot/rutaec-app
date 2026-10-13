import type { RouteObject } from "react-router-dom";
import Passenger from "./pages/Passenger";

export const reservasRoutes: RouteObject[] = [
  { path: "/pasajero", element: <Passenger /> },
  { path: "/reservas", element: <Passenger /> },
];
