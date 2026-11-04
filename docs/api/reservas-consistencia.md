# Reservas consistentes por asiento y tramo

Complemento de #17. Crear una reserva bloquea primero la clave de idempotencia y después las filas de los asientos solicitados, ordenadas por identificador. Tras obtener los bloqueos comprueba los solapes con ocupación confirmada o retenciones vigentes. Usa READ COMMITTED para ver la reserva confirmada por una transacción que se esperaba. Los bloqueos se mantienen hasta terminar la transacción.

Un asiento ocupado devuelve 409 con un mensaje específico. Los tramos consecutivos siguen siendo compatibles. Repetir la misma solicitud devuelve la misma compra y no renueva los cinco minutos. La conversión a texto del retorno void evita el error P2010 de Prisma 7.10.0.

No requiere cambios del esquema. La protección aplica a los endpoints que pasan por este servicio; no sustituye una futura restricción de exclusión para escritores SQL externos. Las confirmaciones tardías deben compartir el bloqueo y la comprobación: se complementa con el PR de operaciones SQL #19.

Pruebas con PostgreSQL real, únicamente en una base local QA que tenga `database/scripts/datos_prueba_viajes.sql`:

```sh
RUTAEC_TEST_DB=1 npm test
```

Sin la variable, las pruebas nuevas de base de datos se omiten explícitamente. La suite prueba creación, idempotencia simultánea, reutilización incorrecta de clave, cancelación, vencimiento, acceso ajeno, cliente contra ventanilla simultáneos, múltiples asientos en orden inverso, tramos consecutivos y ocupación en revisión/confirmada. Los datos QA se conservan con reservas canceladas y sesiones revocadas al terminar; no se borran registros ajenos.
