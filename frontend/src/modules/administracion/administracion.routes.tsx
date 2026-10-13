import type { RouteObject } from "react-router-dom";
import Admin from "./pages/Admin";
import ProjectChanges from "./pages/ProjectChanges";

export const administracionRoutes: RouteObject[] = [
  { path: "/admin", element: <Admin /> },
  { path: "/proyecto", element: <ProjectChanges /> },
];
