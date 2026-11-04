import descuentosRoutes from "./descuentos.routes.js";
import gestionRoutes from "./gestion.routes.js";
import { consultarPortada } from './reservas.service.js';
import { validarBusqueda } from './reservas.validaciones.js';
import { Router } from "express";
import {
  obtenerCiudades,
  obtenerDisponibilidadViaje,
  obtenerViajes,
} from "./reservas.controller.js";

const router = Router();
router.get('/portada',async(req,res)=>{
  const validacion=validarBusqueda({...req.query,destino:'__destino_portada__'});
  if(!validacion.ok){res.status(400).json(validacion.falla);return;}
  try{res.json({data:await consultarPortada(validacion.datos.origen,validacion.datos.fecha)});}
  catch{res.status(500).json({error:'No se pudo cargar la información de viajes.'});}
});

router.get("/viajes", obtenerViajes);
router.get("/ciudades", obtenerCiudades);
router.get("/disponibilidad", obtenerDisponibilidadViaje);

router.use("/descuentos", descuentosRoutes);
router.use(gestionRoutes);

export default router;
