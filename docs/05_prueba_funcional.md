# Demostración funcional sin chofer

> Histórico de la demostración. El 4 de noviembre de 2026 se retiraron sus operaciones y se desactivaron las cuentas de prueba de gerente, oficinista y cliente por solicitud del usuario. El administrador temporal se conserva para iniciar la configuración real. Consultar `06_prueba_datos_reales.md` para el recorrido actual. No volver a ejecutar los preparadores DEMO para seguir ese recorrido.

## Acceso

El entorno local utiliza los roles administrador, gerente, oficinista y cliente. Las cuentas `admin.prueba@example.com`, `gerente.a@example.com`, `oficinista.a@example.com`, `gerente.b@example.com`, `oficinista.b@example.com` y `cliente.prueba@example.com` ya están creadas. No guardar contraseñas en este documento ni en el repositorio.

## Preparación de datos

Las ciudades y terminales iniciales se cargan desde `database/init/rutaec_catalogo.sql`. Las terminales son referenciales de desarrollo. Las tablas para ajustes y correo local se inicializan desde `database/init/rutaec_configuracion.sql`. Compose ejecuta ambos scripts al inicializar una base nueva; en una existente se aplican sin eliminar volúmenes.

`backend/scripts/preparar-demo.ts` agrega datos identificados como DEMO: resoluciones sin validez oficial, cuentas bancarias a las que no se debe transferir, políticas académicas de descuento, buses con asientos Normal y VIP, rutas Ambato–Latacunga–Quito y viajes durante los siete días siguientes. Solo funciona en development; no sustituye los datos oficiales. Conserva los registros existentes.

## Gerente

1. Resoluciones: registrar o editar número, autoridad, emisión y vigencia del documento de su cooperativa.
2. Rutas: crear recorridos, agregar paradas y editar el nombre. Las paradas de una ruta que ya tiene frecuencias no se pueden sustituir; crear una ruta diferente en ese caso.
3. Frecuencias: seleccionar ruta, resolución, hora y días; editar o activar/desactivar.
4. Flota y distribución: registrar el bus y generar exactamente su capacidad de asientos. En cada asiento se puede elegir categoría Normal/VIP y atributos preferencial/accesible. La distribución de un bus que ya tiene viajes no se reemplaza, para conservar sus referencias.
5. Hoja de ruta: consultar asignaciones reales por bus y día. Programación manual permite elegir bus, frecuencia, fechas y tarifas por cada tramo. Generación con rotación alterna los buses elegidos entre los días de una frecuencia y utiliza el siguiente disponible si existe un bloqueo. Presenta los viajes creados y los días omitidos con motivo. Los buses sin viaje se muestran como parada; descansos y mantenimientos se registran en la agenda.
6. Cuentas bancarias: registrar, editar y activar/desactivar las cuentas receptoras de su cooperativa.
7. Personalización: logo, portada, colores, contacto y redes de su cooperativa.

## Administrador

Gestiona cooperativas, usuarios, gerentes, políticas de descuento y ajustes generales. Las políticas son versionadas: cuando una ya tiene validaciones documentales no se reescribe su contenido; crear una nueva versión. Los porcentajes DEMO son académicos, no una afirmación de la normativa vigente.

## Cliente y oficinista

El cliente puede comparar cooperativas o seleccionar una, buscar viajes, filtrar, elegir paradas, seleccionar asientos y confirmar pasajeros. La reserva conserva el asiento durante cinco minutos y el importe definitivo se calcula en el servidor. La carga del comprobante lleva a una revisión manual. El oficinista toma la revisión, comprueba importe y referencia, y aprueba, solicita corrección o rechaza con motivo.

La aprobación correcta confirma la compra y emite un boleto por pasajero. Se puede consultar después desde Mis viajes y descargar boleto PDF, QR y recibo. La aplicación permite otra compra. El oficinista inicia ventas desde Ventanilla consultando primero una cuenta de cliente verificada.

Para descuentos, el cliente presenta su documento y solicita una política; el oficinista revisa y decide. Solo una validación aprobada, correspondiente al pasajero, cooperativa, edad y vigencia del viaje, puede descontar el importe.

## Correo de desarrollo

Sin SMTP, exclusivamente en `NODE_ENV=development`, el transporte guarda los mensajes en PostgreSQL. `/correo-local` permite consultar los mensajes de una cuenta mediante su correo y contraseña, incluso antes de verificarla. No existe acceso anónimo al contenido. Se utiliza para códigos de registro, cambio de correo y enlaces de recuperación. En producción requiere SMTP y la bandeja local queda deshabilitada.

Los avisos dentro de la aplicación no dependen del éxito del envío externo de boletos. Los destinatarios de prueba `example.com` no reciben mensajes externos. Los pagos aprobados contra cuentas `BANCO DEMO` en desarrollo se marcan como demostración, se excluyen del ingreso real en reportes y sus boletos se identifican como DEMO.

## Verificaciones ejecutadas

- `npm run typecheck` en backend y `npm run build` en frontend.
- Suite del backend y pruebas existentes del frontend.
- `scripts/verificar-flujo-demo.ts`: búsqueda, reserva, idempotencia, rechazo de asiento repetido, comprobante PDF sintético, aislamiento por cooperativa, aprobación, boleto PDF/QR, recibo e historial.
- `scripts/verificar-descuentos-demo.ts`: solicitud y aprobación documental, descuento aplicado en servidor, compra entre paradas, liberación de reserva, reserva de ventanilla y recuperación por correo local.
- `scripts/verificar-gestion-demo.ts`: edición de resoluciones y cuentas con aislamiento, persistencia de ajustes, rotación de buses, descanso y registro/verificación/inicio de sesión de un cliente nuevo.

Los scripts de integración requieren desarrollo, los datos DEMO y `DEMO_PASSWORD` en el entorno. Dejan los registros de demostración para revisarlos desde la aplicación. No hacen movimientos de dinero. No modificar datos oficiales para ejecutar las pruebas.
