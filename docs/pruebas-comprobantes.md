# Pruebas manuales de pagos y comprobantes

- Proyecto: RutaEC
- Responsable: Integrante 5
- Issue: #18
- Rama: feature/18-comprobantes
- Fecha: 20/10/2026 (actualizado el 27/10/2026 tras la revisión del PR)
- Entorno: backend y PostgreSQL 17 en Docker local; comprobantes en un volumen privado de Docker.
- Datos: usuarios de prueba creados con backend/scripts/crear-usuario-login.ts, viajes de database/scripts/datos_prueba_viajes.sql, y una compra RESERVADA creada con SQL local (el módulo de reservas todavía no tiene endpoint para reservar; la reserva dura 5 minutos).

## Flujo

El pago y el comprobante se registran en un solo paso con POST /api/pagos (multipart/form-data). El backend llama a la función rutaec.recibir_comprobante de la base de datos, que en una transacción:

- crea el pago directamente en EN_REVISION, con su comprobante;
- crea la fila en revisiones para que el oficinista la vea;
- pasa la compra a EN_REVISION;
- encola el evento COMPROBANTE_RECIBIDO;
- si la reserva venció, marca la compra VENCIDA y no crea el pago.

Campos del formulario: compra_id, metodo (DEPOSITO o TRANSFERENCIA), cuenta_bancaria_id, clave_idempotencia, numero_referencia, fecha_operacion (AAAA-MM-DD), importe_declarado y archivo (JPG, PNG o PDF, máximo 5 MB).

El usuario de la transacción se fija con app.usuario_id, por lo que la auditoría guarda el actor.

## Resultados

| Caso | Resultado esperado | Resultado observado |
|---|---|---|
| GET /api/pagos, GET /api/pagos/pendientes, POST /api/pagos y GET del comprobante sin sesión | 401 | Correcto |
| POST /api/pagos desde un origen no autorizado | 403 | Correcto |
| POST /api/pagos con datos vacíos | 400 compra_id inválido | Correcto |
| POST /api/pagos con método TARJETA | 400, solo DEPOSITO o TRANSFERENCIA | Correcto |
| POST /api/pagos con un archivo que dice ser PNG pero no lo es | 400 | Correcto |
| POST /api/pagos con un archivo de más de 5 MB | 413 | Correcto |
| Otro cliente paga una compra ajena | 404 | Correcto |
| POST /api/pagos sin sesión con datos válidos | 401 | Correcto |
| El dueño registra el pago con su comprobante sobre una compra RESERVADA | 201, pago y compra en EN_REVISION | Correcto |
| Repetir con la misma clave de idempotencia | 200, mismo pago, sin duplicar | Correcto |
| Registrar otro pago sobre una compra que ya está en EN_REVISION | 409 | Correcto |
| Cliente consulta los pagos pendientes | 403 | Correcto |
| El oficinista de la cooperativa consulta los pendientes | 200 con el pago | Correcto |
| El oficinista descarga el comprobante | 200, archivo idéntico al original | Correcto |
| Otro cliente descarga el comprobante | 404 | Correcto |
| Descargar el comprobante sin sesión | 401 | Correcto |
| Cada cliente lista sus pagos | Solo ve los suyos | Correcto |

## Persistencia comprobada

- El pago queda en pagos con estado EN_REVISION y la compra pasa a EN_REVISION en la misma transacción.
- Se crea una fila en revisiones (tipo PAGO, estado PENDIENTE) con el id del pago.
- Se encola un evento COMPROBANTE_RECIBIDO en eventos_salida con el id del pago.
- La auditoría registra el actor (actor_id) del usuario que paga, tanto en el INSERT del pago como en el UPDATE de la compra.
- El archivo se registra en archivos con privado = true, tipo image/png, tamaño y sha256 calculados en el servidor.
- El comprobante se registra en comprobantes_pago con su número de referencia, fecha e importe declarado.
- El archivo se guarda en el volumen de Docker con permisos de lectura solo para su dueño.
- El archivo sobrevive a la reconstrucción del contenedor del backend.

## Evidencias

Las capturas están adjuntas en el Pull Request. No se incluyen contraseñas, cookies ni credenciales.

## Pendientes

Estas pruebas fueron manuales y con datos locales.

- Reserva vencida: el código rechaza la subida con 409, pero no se probó esperando los 5 minutos.
- Falla de la base de datos durante la subida y borrado del archivo huérfano.
- Subidas simultáneas para la misma compra.
- Descarga por el gerente y por el administrador.
- Pantalla de carga del comprobante en el frontend.
- Reenvío de un comprobante en estado CORRECCION y aprobación o rechazo del pago (Issue #19).
- Pruebas automáticas.
