# Prueba con datos propios

Limpieza del 4 de noviembre de 2026: eliminados 16 viajes, 3 buses, 2 frecuencias y 4 compras generados por la demostración, junto con pagos, boletos, revisiones y dependencias asociadas. Cuentas de prueba de gerente, oficinista, cliente y registro automático desactivadas. Respaldo local previo en `database/backups/rutaec-antes-limpieza-demo-20261104.backup`, excluido de Git. La auditoría se conserva.

Se conserva el administrador temporal para evitar perder el acceso. Puede actualizar sus datos desde Mi perfil. La frecuencia preexistente `UIO-AMB-2026` y su viaje se conservaron: aún referencian una resolución DEMO. Sustituir la referencia por una resolución auténtica desde la edición de frecuencia. Las terminales de prueba que ya tienen recorridos también se conservan por integridad histórica; registrar terminales nuevas verificadas para los nuevos recorridos.

## Orden de preparación

1. Administrador: registrar terminales con ciudad, nombre y dirección verificados. Las ciudades ya están en el catálogo.
2. Administrador: registrar cooperativa con razón social, nombre comercial, RUC, contactos y estado activo.
3. Administrador: registrar gerente y asignarlo a esa cooperativa. Verificar su correo antes de iniciar sesión.
4. Administrador: registrar las políticas de descuento que corresponda, con fuente y vigencia verificadas.
5. Gerente: crear grupo de buses, registrar bus activo y configurar asientos hasta completar su capacidad.
6. Gerente: registrar la resolución auténtica, la ruta con terminales verificadas y sus paradas, y la frecuencia con resolución, horario y días.
7. Gerente: registrar la cuenta bancaria receptora y configurar la identidad de la cooperativa.
8. Gerente: crear y verificar la cuenta del oficinista.
9. Gerente: programar el viaje en Hoja de ruta, con fecha futura, bus, frecuencia y tarifas por cada tramo vendible. Consultar que la salida quede publicada.
10. Cliente: registrarse, verificar correo, seleccionar la cooperativa, buscar el recorrido y la fecha publicados, reservar asientos y completar pasajeros.
11. Cliente: presentar el comprobante. Oficinista: tomar la revisión y registrar la decisión tras comprobar la información. Cliente: consultar reserva e historial y descargar boleto, QR y recibo cuando se confirme.
12. Descuentos: cliente solicita con su documento; oficinista revisa; cliente realiza una compra para ese pasajero con la validación aprobada.
13. Ventanilla: consultar un cliente verificado, buscar una salida y completar la venta a nombre del cliente.
14. Reportes: consultar fechas y exportar CSV. Administrador ve todas las cooperativas o filtra una; gerente y oficinista quedan limitados a su cooperativa.
15. Cancelaciones: administrador o gerente selecciona la salida, registra motivo y confirma. Verificar estado cancelado, cierre de ventas, anulación de boletos y seguimiento de los casos con pagos. La cancelación no ejecuta transferencias bancarias ni devuelve dinero automáticamente.

Sin SMTP configurado en desarrollo, los códigos se consultan en Correo local usando el correo y contraseña de la cuenta correspondiente. Esto también sirve para verificar los usuarios creados por el administrador o gerente.

Para comprobar aislamiento, repetir el registro de otra cooperativa, gerente y oficinista con otros correos y datos propios. Sus colores, personal, flota y operaciones no deben mezclarse.

Validado: compilación frontend, tipos backend, consulta autenticada de catálogos/reportes/cancelaciones, rechazo de acceso anónimo, rechazo de entradas inválidas y restauración de las cuatro protecciones de snapshots y agenda tras la limpieza. No se cancelaron viajes ajenos a la demostración durante esta verificación.
