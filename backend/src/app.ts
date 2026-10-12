
import express from "express";
import cors from "cors";
import { prisma } from "./lib/prisma.js";

const app = express();

app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:5174"],
}));

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    message: "API de RutaEC funcionando correctamente",
  });
});

app.get("/api/cooperativas", async (_req, res) => {
  try {
    const cooperativas = await prisma.cooperativas.findMany({
      select: {
        id: true,
        nombre_comercial: true,
        razon_social: true,
        activa: true,
      },
    });

    res.status(200).json({
      total: cooperativas.length,
      datos: cooperativas,
    });
  } catch (error) {
    console.error("Error al consultar cooperativas:", error);

    res.status(500).json({
      error: "No se pudieron consultar las cooperativas",
    });
  }
});

export default app;
