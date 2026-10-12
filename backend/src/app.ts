
import express from "express";
import cors from "cors";

const app = express();

app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:5174"]
}));

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    message: "API de RutaEC funcionando correctamente"
  });
});

export default app;
