import type { RouteObject } from "react-router-dom";
import Manager from "./pages/Manager";

export const cooperativasRoutes: RouteObject[] = [
  { path: "/gerente", element: <Manager /> },
  { path: "/cooperativas", element: <Manager /> },
];
