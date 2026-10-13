import type { RouteObject } from "react-router-dom";
import Clerk from "./pages/Clerk";

export const pagosRoutes: RouteObject[] = [
  { path: "/oficinista", element: <Clerk /> },
  { path: "/pagos", element: <Clerk /> },
];
