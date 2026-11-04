# API de frecuencias (`/api/horarios`)

Una frecuencia define la hora de salida diaria de una ruta, los días de la
semana en que opera y la resolución que la respalda.

Las respuestas de error tienen la forma `{ "error": "mensaje" }`.
Los días usan la numeración ISO: 1 = lunes … 7 = domingo.

## Permisos

| Endpoint | Acceso |
|---|---|
| `GET /frecuencias` | Público |
| `GET /resoluciones` | `admin` y `cooperativa` |
| `POST /frecuencias` | `admin` y `cooperativa` |
| `PUT /frecuencias/:id` | `admin` y `cooperativa` |

Un usuario `cooperativa` solo trabaja con su propia cooperativa (la toma de su
sesión). El `admin` indica la cooperativa en el cuerpo (`cooperativa_id`).
Sin sesión se responde `401`; con un rol no permitido, `403`.

## GET /api/horarios/frecuencias

Lista todas las frecuencias con su cooperativa, ruta, resolución y días.

```json
{
  "total": 1,
  "datos": [
    {
      "id": "…",
      "codigo": "UIO-AMB-0600",
      "cooperativa_id": "…",
      "cooperativa": "Demo RutaEC",
      "ruta_id": "…",
      "ruta": "Quito - Ambato",
      "resolucion_id": "…",
      "resolucion": "RES-2026-001",
      "hora_salida": "06:00",
      "zona_horaria": "America/Guayaquil",
      "activa": true,
      "dias": [1, 2, 3, 4, 5]
    }
  ]
}
```

## GET /api/horarios/resoluciones

Resoluciones de la cooperativa. El `admin` puede enviar `?cooperativa_id=<uuid>`
(un valor que no sea UUID responde `400`).

## POST /api/horarios/frecuencias

```json
{
  "cooperativa_id": "uuid (solo admin)",
  "codigo": "UIO-AMB-0600",
  "ruta_id": "uuid",
  "resolucion_id": "uuid",
  "hora_salida": "06:00",
  "dias": [1, 2, 3, 4, 5]
}
```

Respuesta `201` con la frecuencia creada. La frecuencia y sus días se guardan
en una sola transacción.

| Código | Causa |
|---|---|
| 400 | Datos inválidos (código vacío, UUID mal formado, hora fuera de `HH:MM`, días vacíos, repetidos o fuera de 1–7), ruta inexistente o inactiva, o resolución no vigente |
| 403 | La cuenta `cooperativa` no tiene cooperativa asociada |
| 409 | Ya existe una frecuencia con ese código en la cooperativa |

## PUT /api/horarios/frecuencias/:id

Mismo cuerpo que el POST (sin `cooperativa_id`) más `activa` (opcional,
booleano) para activar o desactivar. Reemplaza los días de la frecuencia.
Al desactivar no se exige que la ruta y la resolución sigan vigentes.

Respuestas: `200`, `400`, `403` (frecuencia de otra cooperativa), `404`
(no existe) y `409` (código duplicado).
