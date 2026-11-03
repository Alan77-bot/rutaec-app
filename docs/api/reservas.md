# API de reservas: búsqueda de viajes y disponibilidad de asientos

Módulo `reservas` (Integrante 4). Esta página documenta los endpoints de
**búsqueda** (Issue #15) y de **disponibilidad de asientos** (Issue #16) que ya
están implementados. El de reservas se agregará en la Issue #17.

Base: `/api/reservas`. Los tres endpoints son públicos (no piden sesión).

## Formato de las respuestas

Correcta:

```json
{ "data": [], "message": "Operacion correcta" }
```

Con error:

```json
{ "error": "Mensaje para mostrar al usuario", "code": "CODIGO_DEL_ERROR" }
```

| Código | Estado HTTP | Cuándo ocurre |
| --- | --- | --- |
| `PARAMETROS_INVALIDOS` | 400 | Falta `origen`, `destino` o `fecha`; hay más de 80 caracteres; el origen es igual al destino; o un parámetro viene repetido. |
| `FECHA_INVALIDA` | 400 | La fecha no tiene el formato `AAAA-MM-DD` o no existe (por ejemplo 31 de febrero). |
| `FECHA_PASADA` | 400 | La fecha es anterior a hoy (hora de Ecuador). La fecha de hoy sí se acepta. |
| `NO_ENCONTRADO` | 404 | Solo en la disponibilidad: el viaje no existe, ya no está a la venta o no pasa por esas ciudades en ese orden. |
| `ERROR_INTERNO` | 500 | Falló la consulta a la base de datos. |

## GET /api/reservas/viajes

Busca los viajes que pasan por la ciudad de origen y luego por la de destino
(en ese orden) y cuya salida desde el origen cae en la fecha indicada.

| Parámetro | Ejemplo | Descripción |
| --- | --- | --- |
| `origen` | `Ambato` | Nombre de la ciudad de origen (sin distinguir mayúsculas). |
| `destino` | `Quito` | Nombre de la ciudad de destino. |
| `fecha` | `2026-10-23` | Día de salida, formato `AAAA-MM-DD`, en hora de Ecuador (America/Guayaquil). |

Ejemplo:

```
GET /api/reservas/viajes?origen=Ambato&destino=Quito&fecha=2026-10-23
```

Respuesta (un viaje; la lista viene ordenada por hora de salida):

```json
{
  "data": [
    {
      "viaje_id": "5714bd7f-2331-4b53-860b-66ec8d030303",
      "origen_orden": 2,
      "destino_orden": 3,
      "origen_terminal": "Terminal Terrestre de Ambato",
      "destino_terminal": "Terminal Terrestre de Quito",
      "salida": "2026-10-23T13:05:00.000Z",
      "llegada": "2026-10-23T15:30:00.000Z",
      "cierre_ventas": "2026-10-23T11:00:00.000Z",
      "cupos_disponibles": 40,
      "cooperativa": {
        "id": "c006d063-1212-4322-9d81-fed132a420d5",
        "nombre": "Andes Express (prueba)",
        "color_primario": "#16324F",
        "color_secundario": "#F2B705"
      },
      "bus": {
        "id": "27f94932-5675-43fa-afbe-e3e956374cfc",
        "numero_unidad": "101",
        "placa": "TST-0001",
        "pisos": 1,
        "capacidad": 40,
        "imagen_url": null,
        "marca_chasis": "Hino",
        "marca_carroceria": "Picosa"
      },
      "tarifas": [
        { "categoria": "NORMAL", "importe": 3.5, "moneda": "USD" },
        { "categoria": "VIP", "importe": 4.5, "moneda": "USD" }
      ],
      "paradas": [
        {
          "orden": 2,
          "terminal": "Terminal Terrestre de Ambato",
          "llegada": "2026-10-23T13:00:00+00:00",
          "salida": "2026-10-23T13:05:00+00:00"
        },
        {
          "orden": 3,
          "terminal": "Terminal Terrestre de Quito",
          "llegada": "2026-10-23T15:30:00+00:00",
          "salida": "2026-10-23T15:30:00+00:00"
        }
      ]
    }
  ],
  "message": "Operacion correcta"
}
```

Las horas se devuelven en UTC; el frontend las muestra en hora de Ecuador
(UTC-5). Si no hay viajes, `data` es una lista vacía.

### Campos

- `origen_orden` y `destino_orden`: posición de las paradas del pasajero dentro
  del recorrido del viaje. Un viaje de Riobamba a Quito que pasa por Ambato
  tiene tres paradas; quien sube en Ambato usa `origen_orden: 2`.
- `cupos_disponibles`: capacidad vendible menos la ocupación **más alta** de los
  tramos que recorre el pasajero. Cuenta asientos vendidos y reservas vigentes
  (las reservas caducan a los 5 minutos). Un asiento ocupado en cualquier tramo
  del recorrido no se cuenta como libre.
- `tarifas`: tarifas vigentes del tramo exacto buscado, una por categoría
  (`NORMAL`, `VIP`). Puede venir vacía si el viaje no tiene tarifa para ese
  tramo.
- `paradas`: solo las paradas entre el origen y el destino buscados, en orden.

### Qué viajes se incluyen

Solo los que se pueden comprar, con las mismas reglas que valida la función
`reservar_compra` de la base de datos:

- viaje en estado `PUBLICADO`;
- `cierre_ventas` todavía en el futuro;
- cooperativa activa;
- frecuencia activa;
- paradas de subida y bajada permitidas en el origen y el destino.

## GET /api/reservas/ciudades

Lista las ciudades por las que pasa al menos un viaje que se puede comprar
(mismas reglas de arriba). Sirve para llenar los selectores de origen y
destino sin ofrecer ciudades sin servicio.

```
GET /api/reservas/ciudades
```

```json
{
  "data": [
    { "nombre": "Ambato", "provincia": "Tungurahua" },
    { "nombre": "Quito", "provincia": "Pichincha" },
    { "nombre": "Riobamba", "provincia": "Chimborazo" }
  ],
  "message": "Operacion correcta"
}
```

Vienen ordenadas por nombre y sin repetir.

## GET /api/reservas/disponibilidad

Estado de cada asiento de un viaje **para el tramo que va a recorrer el
pasajero**. Es lo que dibuja el mapa de asientos de la compra.

| Parámetro | Ejemplo | Descripción |
| --- | --- | --- |
| `viajeId` | `b5a24a1e-fe28-...` | Identificador del viaje (`viaje_id` de la búsqueda). |
| `origen` | `Ambato` | Ciudad donde sube el pasajero. |
| `destino` | `Quito` | Ciudad donde baja. |

```
GET /api/reservas/disponibilidad?viajeId=b5a24a1e-fe28-427f-b26c-92cc27577256&origen=Ambato&destino=Quito
```

Respuesta (acortada: `viaje` trae los mismos campos que un resultado de la
búsqueda, y de los 40 asientos se muestran tres):

```json
{
  "data": {
    "viaje": {
      "viaje_id": "b5a24a1e-fe28-427f-b26c-92cc27577256",
      "origen_orden": 2,
      "destino_orden": 3,
      "salida": "2026-10-27T13:05:00.000Z",
      "llegada": "2026-10-27T15:30:00.000Z",
      "cupos_disponibles": 40,
      "cooperativa": { "nombre": "Andes Express (prueba)" },
      "bus": { "placa": "TST-0001", "pisos": 1, "capacidad": 40 },
      "tarifas": [
        { "categoria": "NORMAL", "importe": 3.5, "moneda": "USD" },
        { "categoria": "VIP", "importe": 4.5, "moneda": "USD" }
      ],
      "paradas": [ "... solo las paradas entre el origen y el destino ..." ]
    },
    "recorrido": [
      {
        "orden": 1,
        "terminal": "Terminal Terrestre de Riobamba",
        "ciudad": "Riobamba",
        "llegada": "2026-10-27T12:00:00.000Z",
        "salida": "2026-10-27T12:00:00.000Z",
        "permite_subida": true,
        "permite_bajada": true
      },
      { "orden": 2, "ciudad": "Ambato", "...": "..." },
      { "orden": 3, "ciudad": "Quito", "...": "..." }
    ],
    "resumen": {
      "total": 40,
      "libres": 40,
      "ocupados": 0,
      "retenidos": 0,
      "no_vendibles": 0
    },
    "asientos": [
      {
        "id": "7b7501bb-d7f0-40f4-a7fe-000558979119",
        "numero": "1A",
        "piso": 1,
        "fila": 1,
        "columna": 1,
        "categoria": "VIP",
        "accesible": false,
        "preferencial": false,
        "estado": "LIBRE",
        "precio": 4.5
      }
    ]
  },
  "message": "Operacion correcta"
}
```

### Campos

- `recorrido`: **todas** las paradas del viaje (no solo las del tramo del
  pasajero), con su ciudad y si en ella se puede subir o bajar. Permite cambiar
  dónde sube o baja sin volver a buscar.
- `resumen`: cuántos asientos hay en cada estado para ese tramo.
- `asientos`: ordenados por piso, fila y columna. `precio` es el importe de la
  tarifa de su categoría en el tramo, o `null` si no hay tarifa.

### Estados de un asiento

| Estado | Significado |
| --- | --- |
| `LIBRE` | Se puede elegir. |
| `OCUPADO` | Tiene una venta confirmada que se cruza con el tramo del pasajero. |
| `RETENIDO` | Otra persona lo reservó y todavía no se pagó: la reserva dura 5 minutos, o sigue vigente mientras su pago está en revisión. Si la reserva vence o se cancela, vuelve a `LIBRE`. |
| `NO_VENDIBLE` | La cooperativa lo dejó fuera de venta. |

El estado depende del **tramo**: un asiento vendido de Ambato a Quito sigue
`LIBRE` para quien viaja de Riobamba a Ambato, y `OCUPADO` para quien viaja de
Riobamba a Quito (porque pasa por el tramo vendido).

Solo se consideran los viajes que se pueden comprar, con las mismas reglas de la
búsqueda. Si el viaje deja de estar a la venta, responde `404 NO_ENCONTRADO`.

## Cómo probarlo en local

1. Levantar el proyecto: `docker compose up -d --build`.
2. Cargar los datos de prueba (cooperativas y viajes ficticios para los próximos
   7 días; se puede repetir sin duplicar):

   ```powershell
   Get-Content database/scripts/datos_prueba_viajes.sql -Raw |
     docker compose exec -T postgres psql -U <POSTGRES_USER> -d <POSTGRES_DB> -v ON_ERROR_STOP=1
   ```

   El usuario y la base de datos están en tu archivo `.env`.
3. Consultar:

   ```powershell
   curl.exe "http://localhost:3000/api/reservas/viajes?origen=Ambato&destino=Quito&fecha=2026-10-23"
   curl.exe "http://localhost:3000/api/reservas/ciudades"
   curl.exe "http://localhost:3000/api/reservas/disponibilidad?viajeId=<viaje_id>&origen=Ambato&destino=Quito"
   ```

4. Pruebas automáticas: `npm test` dentro de `backend`. Las pruebas que usan la
   base de datos se omiten solas si no hay conexión o si faltan los datos de
   prueba.
