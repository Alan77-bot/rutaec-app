import { Router } from "express";

const router = Router();

// GET /api/buses
router.get("/", (req, res) => {
  res.json({ message: "Listado de buses y flota" });
});

export default router;
