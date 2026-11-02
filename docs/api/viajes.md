# API de programación de viajes (`/api/horarios`)

Estos endpoints son de **administración**: generan, listan y modifican los
viajes de una cooperativa. La búsqueda pública de viajes y el mapa de asientos
están en `/api/reservas` (Issues #15 y #16) y leen los viajes creados aquí.

Todas las rutas exigen sesión y rol `admin` o `cooperativa` (401 sin sesión,
403 con otro rol). El rol `cooperativa` solo ve y modifica su propia
cooperativa. Los errores tienen la forma `{ "error": "mensaje" }`.

## Cómo se arma un viaje

Al programar, por cada fecha en que opera la frecuencia se hace, en una sola
transacción:

1. Se bloquea el bus y se comprueba que no tenga otro viaje, descanso o
   mantenimiento que se cruce con el horario (`agenda_bus` activa).
2. Se usa la hoja de ruta del día del grupo del bus (se crea `PUBLICADA` si no
   existe) y se registra la agenda del bus (`VIAJE`, de la salida a la llegada).
3. Se crea el viaje en `BORRADOR` y se copian:
   - **paradas** (`paradas_viaje`): las de la ruta, con su terminal, su nombre y
     la hora de llegada y salida (5 minutos de espera en las intermedias);
   - **asientos** (`asientos_viaje`): los asientos activos del bus con su
     número, piso, fila, columna, categoría, accesible y preferencial;
   - **tarifas** (`tarifas_viaje`): una por tramo y categoría (NORMAL, y VIP si
     el bus tiene asientos VIP), vigentes desde la fecha del viaje.
4. Se publica el viaje. La base valida la publicación (trigger
   `validar_publicacion`): capacidad, pisos, paradas iguales a la ruta, hora y
   día de la frecuencia, resolución vigente y cierre de ventas.

Si un día no se puede programar, se informa en `omitidos` y los demás se crean.

## GET /api/horarios/buses

Buses de la cooperativa (el admin puede filtrar con `?cooperativa_id=`), con
`capacidad`, `pisos`, `estado`, `asientos_activos` y `asientos_vip`. Solo se
puede asignar un bus `ACTIVO` cuyos asientos activos sean igual a su capacidad.

## POST /api/horarios/viajes/programar

```json
{
  "frecuencia_id": "uuid",
  "bus_id": "uuid",
  "desde": "2026-11-02",
  "hasta": "2026-11-08",
  "minutos_cierre": 60,
  "fuente_normativa": "Resolución ANT de tarifas 2026",
  "tarifas": [
    { "origen_orden": 1, "destino_orden": 2, "normal": 2.00, "vip": 2.50 },
    { "origen_orden": 2, "destino_orden": 3, "normal": 3.50, "vip": 4.50 },
    { "origen_orden": 1, "destino_orden": 3, "normal": 5.00, "vip": 6.50 }
  ]
}
```

- Rango de hasta 31 días y sin fechas pasadas.
- Debe haber una tarifa para **cada tramo vendible** de la ruta (de una parada
  con subida a otra posterior con bajada). Si el bus tiene asientos VIP, cada
  tramo necesita también su tarifa `vip`.
- Importes mayores que 0, hasta 1000 y con 2 decimales como máximo.
- `minutos_cierre` (opcional, por defecto 60): minutos antes de la salida en que
  se cierra la venta.

Respuesta `201` si se creó al menos un viaje (`200` si ninguno):

```json
{
  "mensaje": "Se programaron 7 viajes",
  "datos": {
    "creados": [
      { "id": "…", "fecha": "2026-11-02", "salida": "08:00", "llegada": "11:30", "asientos": 40 }
    ],
    "omitidos": [
      { "fecha": "2026-11-03", "motivo": "El bus 501 ya tiene otro viaje de 07:00 a 09:30" }
    ]
  }
}
```

Motivos de días omitidos: viaje repetido de la misma frecuencia, cruce de
horario del bus, resolución no vigente ese día, venta que ya estaría cerrada u
hoja de ruta del día que no está publicada.

| Código | Causa |
|---|---|
| 400 | Datos inválidos, frecuencia o ruta desactivada, bus inválido o de otra cooperativa, falta una tarifa |
| 403 | La frecuencia es de otra cooperativa |
| 404 | La frecuencia no existe |

## GET /api/horarios/viajes

Parámetros opcionales: `desde` y `hasta` (`YYYY-MM-DD`, hora de Ecuador; por
defecto hoy y 14 días después, máximo 63 días) y `cooperativa_id` (solo admin).

Cada viaje trae `fecha`, `salida`, `llegada`, `ruta`, `frecuencia`, `bus`
(número y placa), `estado`, `cierre_ventas`, `asientos`, `vendidos` y
`reservados`.

## PATCH /api/horarios/viajes/:id/cancelar

Cuerpo `{ "motivo": "Mantenimiento del bus" }` (5 a 300 caracteres). Solo se
cancela un viaje sin asientos vendidos ni reservados; la agenda del bus queda
libre para otro viaje. Respuestas: `200`, `400`, `403`, `404` y `409` (ya
cancelado, cerrado o con ventas).

## PATCH /api/horarios/viajes/:id/cierre

Cuerpo `{ "minutos_cierre": 30 }`. Cambia el cierre de ventas de un viaje
publicado. Responde `400` si con ese valor la venta ya estaría cerrada y `409`
si el viaje no está publicado.
