import { Router } from "express";

import usuariosRoutes from "../modules/usuarios/usuarios.routes.js";
import cooperativasRoutes from "../modules/cooperativas/cooperativas.routes.js";
import rutasRoutes from "../modules/rutas/rutas.routes.js";
import horariosRoutes from "../modules/horarios/horarios.routes.js";
import reservasRoutes from "../modules/reservas/reservas.routes.js";
import ventanillaRoutes from "../modules/pagos/ventanilla.routes.js";
import boletosRoutes from "../modules/boletos/boletos.routes.js";
import recibosRoutes from "../modules/boletos/recibos.routes.js";
import avisosRoutes from "../modules/boletos/avisos.routes.js";
import busesRoutes from "../modules/buses/buses.routes.js";
import reportesRoutes from '../modules/pagos/reportes.routes.js';
import pagosRoutes from "../modules/pagos/pagos.routes.js";
import cuentasPagoRoutes from "../modules/pagos/cuentas.routes.js";
import tarjetaDemoRoutes from "../modules/pagos/tarjeta.demo.routes.js";
import administracionRoutes from "../modules/administracion/administracion.routes.js";
import revisionesRoutes from "../modules/pagos/revisiones.routes.js";
import incidenciasRoutes from "../modules/pagos/incidencias.routes.js";

const router = Router();

router.use("/usuarios", usuariosRoutes);
router.use("/cooperativas", cooperativasRoutes);
router.use("/ventas", ventanillaRoutes);
router.use("/buses", busesRoutes);
router.use("/pagos", cuentasPagoRoutes);
router.use("/pagos", tarjetaDemoRoutes);
router.use("/rutas", rutasRoutes);
router.use("/pagos/revisiones", revisionesRoutes);
router.use("/incidencias", incidenciasRoutes);
router.use("/horarios", horariosRoutes);
router.use("/reservas", reservasRoutes);
router.use("/boletos", boletosRoutes);
router.use("/boletos", recibosRoutes);
router.use("/notificaciones", avisosRoutes);
router.use("/pagos", pagosRoutes);
router.use("/administracion", administracionRoutes);
router.use('/reportes-operativos', reportesRoutes);

export default router;
