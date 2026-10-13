import type { RouteObject } from "react-router-dom";
import Controller from "./pages/Controller";

export const choferRoutes: RouteObject[] = [
  { path: "/controlador", element: <Controller /> },
  { path: "/chofer", element: <Controller /> },
  { path: "/scanner", element: <Controller /> },
];
