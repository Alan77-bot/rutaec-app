import { Router } from "express";

import usuariosRoutes from "../modules/usuarios/usuarios.routes.js";
import cooperativasRoutes from "../modules/cooperativas/cooperativas.routes.js";
import rutasRoutes from "../modules/rutas/rutas.routes.js";
import horariosRoutes from "../modules/horarios/horarios.routes.js";
import reservasRoutes from "../modules/reservas/reservas.routes.js";
import boletosRoutes from "../modules/boletos/boletos.routes.js";
import busesRoutes from "../modules/buses/buses.routes.js";
import pagosRoutes from "../modules/pagos/pagos.routes.js";
import cuentasPagoRoutes from "../modules/pagos/cuentas.routes.js";
import tarjetaDemoRoutes from "../modules/pagos/tarjeta.demo.routes.js";
import administracionRoutes from "../modules/administracion/administracion.routes.js";

const router = Router();

router.use("/usuarios", usuariosRoutes);
router.use("/cooperativas", cooperativasRoutes);
router.use("/buses", busesRoutes);
router.use("/pagos", cuentasPagoRoutes);
router.use("/pagos", tarjetaDemoRoutes);
router.use("/rutas", rutasRoutes);
router.use("/horarios", horariosRoutes);
router.use("/reservas", reservasRoutes);
router.use("/boletos", boletosRoutes);
router.use("/pagos", pagosRoutes);
router.use("/administracion", administracionRoutes);

export default router;