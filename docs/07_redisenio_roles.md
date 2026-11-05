# Rediseño por roles y venta presencial

## Administrador

Identidad permite seleccionar un color personalizado, introducir su hexadecimal o elegir entre doce colores. Se retiran de su navegación los enlaces de reportes y cancelaciones; los permisos existentes del servidor no se alteran.

## Gerente

El panel abre en Hoja de ruta y ordena sus apartados por operación. Las frecuencias muestran llegada estimada: salida más el último tiempo acumulado de la ruta, incluyendo cambio de día. No se suman otra vez los tiempos de cada parada.

El registro y edición de buses acepta imágenes PNG/JPG/WebP de hasta 2 MB desde el equipo; la URL sigue siendo opcional. El servidor comprueba la cooperativa propietaria y el contenido de la imagen. Se almacenan en `PERSONALIZACION_DIR/buses`, dentro del volumen persistente existente.

La generación de asientos reparte la capacidad entre todos los pisos. Los VIP se muestran amarillos y los preferenciales naranjas. En la edición de un asiento se puede cambiar piso, fila y columna; una posición ocupada intercambia ambos asientos. Se conservan las validaciones de capacidad, pasillo y referencias históricas de buses con viajes.

Mantenimiento y descansos se abre con un botón al inicio de Hoja de ruta. La tabla se oculta mientras se gestiona la agenda; cerrar actualiza la hoja.

Al crear gerentes u oficinistas no se envían códigos ni se crean tokens de verificación. La cuenta sigue sin verificar. Su titular solicita el código, con correo y contraseña, desde la pantalla de verificación. El registro público de clientes conserva su envío inicial.

## Ventanilla

El comprador se registra con cédula, nombres y apellidos; correo opcional. No se crea una cuenta ficticia. El oficinista autenticado es el propietario técnico de la operación; la identidad del comprador se conserva en el evento de reserva y los pasajeros en las instantáneas de compra. La venta se identifica como VENTANILLA.

Después de validar al comprador se consultan las salidas de su cooperativa. Se puede filtrar recorrido y fecha, elegir asientos y registrar varios pasajeros.

Un descuento presencial requiere política vigente, edad compatible cuando corresponda y confirmación explícita de que el oficinista comprobó el documento original. Se registra política, versión, porcentaje, actor y evento de auditoría. El servidor calcula el importe; no acepta porcentajes enviados por el navegador.

Efectivo no exige comprobante adjunto: el oficinista declara el importe recibido y confirma su recepción. El servidor valida canal, cooperativa, vigencia, disponibilidad e idempotencia, confirma la compra y emite boletos. El importe recibido contabilizado es el total; el efectivo entregado y cambio quedan en el motivo del pago.

Las transferencias/depósitos de ventanilla pueden confirmarse en el mismo registro cuando el oficinista declara haber contrastado referencia e importe con el banco. Se conserva el comprobante, la revisión y el registro del revisor. Los pagos de clientes web siempre pasan por revisión manual antes de emitir boletos.

Los documentos disponibles tras confirmarse son boleto PDF con QR y comprobante de venta no fiscal. Se pueden descargar o abrir como PDF para imprimir desde el navegador. No se emiten facturas electrónicas SRI. La tarjeta disponible es una simulación expresamente rotulada, sin cobro real, deshabilitada en producción y sin almacenamiento de PAN/CVV.

## Cliente

Descuentos se retira de la navegación principal y de Mis reservas. Cada pasajero puede solicitar su validación dentro de la compra, después de elegir sus asientos y completar los datos. La solicitud documental no retiene asientos ni concede automáticamente el descuento. Una vez aprobada, se actualizan las validaciones y se selecciona para ese pasajero antes de reservar. También se puede aceptar explícitamente la tarifa sin descuento.

Las políticas ofrecidas son las activas y vigentes de la base; si no existen, la interfaz lo indica y no inventa porcentajes. La validación de edad, pasajero, cooperativa y vigencia permanece en el servidor.

Se retiran los filtros de chasis y carrocería. Reservas muestran recorrido, fecha, pasajeros, canal, estado e importes. Los detalles agrupan pasajero/asiento, descuentos, pagos y documentos. Mis viajes incorpora descarga PDF directa.

## Base de datos y despliegue

Aplicar `database/init/rutaec_ventanilla.sql` en bases existentes antes de iniciar el backend actualizado. Agrega a detalle_compra referencias a la política presencial y al usuario verificador, conserva el respaldo obligatorio del descuento y habilita EFECTIVO exclusivamente con proveedor CAJA_PRESENCIAL y sin cuenta bancaria. El cliente Prisma incluye los nuevos campos.

Compose incluye el script para bases nuevas y habilita tarjeta de prueba en el entorno local. La aplicación vuelve a bloquearla cuando NODE_ENV es production. No se eliminan volúmenes ni ventas existentes.

## Comprobaciones

- Backend: tipos y suite automatizada, incluidas validaciones del comprador presencial.
- Frontend: compilación y pruebas de llegada, distribución equilibrada y espacios especiales, además de las pruebas existentes.
- `backend/scripts/verificar-redisenio.ts` exige una copia llamada `rutaec_redisenio_pruebas` y fuerza su conexión a ese nombre antes de importar Prisma. Prepara cuentas y operaciones solo allí. Comprueba efectivo, idempotencia, aislamiento, descuentos, tarjeta simulada, revisión web, confirmación presencial, PDF/QR/recibo, imagen del bus y envío explícito de verificación del personal.
- Revisión en navegador del administrador, selector de color, panel del gerente, formulario de frecuencia y vista separada de mantenimiento. No se modificaron ni se cobraron ventas reales mediante esa revisión.
