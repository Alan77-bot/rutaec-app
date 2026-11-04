
import ViajaYaRoutes from "./ViajaYaRoutes";
import { PersonalizacionProvider } from "./context/PersonalizacionContext";

export default function App() {
  return <PersonalizacionProvider><ViajaYaRoutes /></PersonalizacionProvider>;
}
