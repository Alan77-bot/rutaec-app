import express from "express";
import cors from "cors";
import apiRoutes from "./routes/index.js";
import personalizacionRoutes from "./modules/cooperativas/personalizacion.routes.js";
import gestionRoutes from './modules/administracion/gestion.routes.js';
import imagenesBuses from './modules/buses/imagenes.routes.js';

const app = express();

app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5174"],
  })
);

app.use('/api', gestionRoutes);
app.use('/api/imagenes-buses', imagenesBuses);
app.use('/api/cooperativas', personalizacionRoutes);
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    message: "API de RutaEC funcionando correctamente",
  });
});

app.use("/api", apiRoutes);

export default app;
