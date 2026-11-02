import "dotenv/config";
import app from "./app.js";
import { iniciarPlazosRevisiones } from './modules/pagos/revisiones.plazos.js';
import { iniciarProcesadorDeCorreos } from "./modules/boletos/boletos.correo.js";

const PORT = Number(process.env.PORT ?? 3000);
iniciarPlazosRevisiones();

app.listen(PORT, () => {
  console.log(`API RutaEC disponible en http://localhost:${PORT}`);
  iniciarProcesadorDeCorreos();
});
