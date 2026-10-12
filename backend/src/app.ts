
import express from "express";
import cors from "cors";
import cooperativasRoutes from "./modules/cooperativas/cooperativas.routes.js";

const app = express();

app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5174"],
  })
);

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    message: "API de RutaEC funcionando correctamente",
  });
});

app.use("/api/cooperativas", cooperativasRoutes);

export default app;
