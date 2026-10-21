# Pruebas manuales de pagos y comprobantes

- Proyecto: RutaEC
- Responsable: Integrante 5
- Issue: #18
- Rama: feature/18-comprobantes
- Fecha: 20/10/2026
- Entorno: backend y PostgreSQL 17 en Docker local; comprobantes en un volumen privado de Docker.
- Datos: usuarios de prueba creados con backend/scripts/crear-usuario-login.ts, viajes de database/scripts/datos_prueba_viajes.sql, y una compra RESERVADA creada con SQL local (el módulo de reservas todavía no tiene endpoint para reservar).

## Resultados

| Caso | Resultado esperado | Resultado observado |
|---|---|---|
| GET /api/pagos, GET /api/pagos/pendientes, POST /api/pagos y GET del comprobante sin sesión | 401 | Correcto |
| POST /api/pagos desde un origen no autorizado | 403 | Correcto |
| POST /api/pagos con datos vacíos | 400 compra_id inválido | Correcto |
| POST /api/pagos con método TARJETA | 400, solo DEPOSITO o TRANSFERENCIA | Correcto |
| Cliente consulta los pagos pendientes | 403 | Correcto |
| Otro cliente intenta pagar una compra ajena | 404 | Correcto |
| El dueño crea el pago de su compra reservada | 201, estado PENDIENTE | Correcto |
| Repetir el pago con la misma clave de idempotencia | 200, sin duplicar | Correcto |
| Subir un archivo que dice ser PNG pero no lo es | 400 | Correcto |
| Subir un archivo de más de 5 MB | 413 | Correcto |
| Otro cliente sube un comprobante al pago ajeno | 404 | Correcto |
| Subir un comprobante sin sesión | 401 | Correcto |
| El dueño sube un PNG válido | 201, pago y compra en EN_REVISION | Correcto |
| Subir un segundo comprobante al mismo pago | 409 | Correcto |
| El oficinista de la cooperativa consulta los pendientes | 200 con el pago | Correcto |
| El oficinista descarga el comprobante | 200, archivo idéntico al original | Correcto |
| Otro cliente descarga el comprobante | 404 | Correcto |
| Descargar el comprobante sin sesión | 401 | Correcto |
| Cada cliente lista sus pagos | Solo ve los suyos | Correcto |

## Persistencia comprobada

- El pago queda en pagos con estado EN_REVISION y la compra pasa a EN_REVISION en la misma transacción.
- El archivo se registra en archivos con privado = true, tipo image/png, tamaño y sha256 calculados en el servidor.
- El comprobante se registra en comprobantes_pago con su número de referencia, fecha e importe declarado.
- El archivo se guarda en el volumen de Docker con permisos de lectura solo para su dueño, dentro de comprobantes/<id del pago>/.
- El archivo sobrevive a la reconstrucción del contenedor del backend.

## Evidencias

Se adjuntan capturas en el Pull Request:

1. Acceso sin sesión y desde otro origen.
2. Validaciones del pago y de la subida.
3. Control de acceso del cliente, del cliente ajeno y del oficinista.
4. Consulta en PostgreSQL y archivo en el volumen.
5. Persistencia del volumen.

No se incluyen contraseñas, cookies ni credenciales.

## Pendientes

Estas pruebas fueron manuales y con datos locales.

- Reserva vencida: el código rechaza la subida con 409, pero no se probó esperando los 5 minutos.
- Falla de la base de datos durante la subida y borrado del archivo huérfano.
- Subidas simultáneas al mismo pago.
- Descarga por el gerente y por el administrador.
- Pantalla de carga del comprobante en el frontend.
- Aprobación y rechazo del pago (Issue #19).
- Pruebas automáticas.
