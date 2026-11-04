# Operaciones SQL y regresión del trámite

Corregir una operación que invoca una función PostgreSQL de retorno void no requiere cambiar la base de datos. Cuando solo interesan sus efectos se utiliza `$executeRaw`, sin intentar deserializar void mediante `$queryRaw`. Las consultas que sí devuelven un identificador, estado u otro dato conservan `$queryRaw`.

Se cubren cambios de contraseña y correo del perfil (#10), recuperación (#29), revisiones y correcciones (#19), ventanilla (#20), emisión en el flujo de tarjeta demo y eventos de cancelación de viajes (#14). No se modifica administración, gestión de personal ni configuración de buses/flota del líder.

Las confirmaciones bloquean los mismos asientos que la creación de reservas y comprueban ocupación de otras compras. Si un pago tardío corresponde a un asiento ya reservado, la compra anterior pasa a incidencia antes de conciliar el dinero: no recupera ni vende el asiento de la nueva reserva.

Las pruebas `operaciones.integration.test.ts` se activan con `RUTAEC_TEST_DB=1`, requieren los datos ficticios de viajes y la corrección de reservas #17. Cubren:

- Contraseña de ocho caracteres y revocación de la sesión anterior.
- Restablecimiento con token preparado, de un solo uso.
- Confirmación de correo con código preparado y revocación de sesiones.
- Dos revisores simultáneos: solo uno obtiene el trámite.
- Corrección y conservación de versiones, aprobación sin boleto duplicado, PDF, QR y recibo.
- Solicitud, aprobación y confirmación de devolución manual, sin transferir dinero.
- Pago tardío frente a una nueva reserva del mismo asiento.
- Recuperación de asignación con tiempo simulado y vencimiento del plazo a incidencia.
- Recepción idempotente de comprobantes desde ventanilla.
- Aprobación documental y aplicación del descuento al reservar.
- Tarjeta aprobada/rechazada e idempotencia, si `TARJETA_MODO_DEMO=true`.

La suite usa datos sintéticos en una base QA, conserva su historial y excluye los pagos de prueba de ingresos reales al finalizar. No acredita envío SMTP de cada plantilla: en las pruebas de cuenta se preparan los códigos/tokens directamente. No realiza cobros reales ni envía correo a personas. Las políticas documentales creadas para la prueba quedan desactivadas.
