import "dotenv/config";
import app from "./app.js";
import { iniciarProcesadorDeCorreos } from "./modules/boletos/boletos.correo.js";

const PORT = Number(process.env.PORT ?? 3000);

app.listen(PORT, () => {
  console.log(`API RutaEC disponible en http://localhost:${PORT}`);
  iniciarProcesadorDeCorreos();
});
