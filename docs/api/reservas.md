# API de reservas: búsqueda de viajes

Módulo `reservas` (Integrante 4). Esta página documenta los endpoints de
**búsqueda** que ya están implementados (Issue #15). Los de asientos y reservas
se agregarán en las Issues #16 y #17.

Base: `/api/reservas`. Los dos endpoints son públicos (no piden sesión).

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
   ```

4. Pruebas automáticas: `npm test` dentro de `backend`. Las pruebas que usan la
   base de datos se omiten solas si no hay conexión o si faltan los datos de
   prueba.
