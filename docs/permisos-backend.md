# Permisos del backend — Issue #11

## Orden de los controles

1. autenticar: comprueba la sesión y el estado de la cuenta.
2. autorizarRoles: comprueba los roles permitidos.
3. autorizarCooperativa: compara la cooperativa de la URL con la sesión.
4. Controlador y servicio: validan la operación y el recurso solicitado.

## Roles de la sesión

| PostgreSQL | Sesión |
|---|---|
| ADMINISTRADOR | admin |
| GERENTE | cooperativa |
| OFICINISTA | oficinista |
| CLIENTE | usuario |

## Ejemplo de integración

Este ejemplo debe adaptarse al controlador real del módulo:

```ts
router.patch(
  "/:coopId",
  ...autenticar,
  autorizarRoles("admin", "cooperativa"),
  autorizarCooperativa("coopId"),
  actualizarCooperativa
);
```

El ejemplo permite modificar la cooperativa al administrador
o a su gerente. No permite la operación al oficinista.

## Recursos pertenecientes a una cooperativa

Comprobar el parámetro coopId no demuestra que un bus, viaje
o pago pertenezca a esa cooperativa.

El servicio debe consultar el recurso usando tanto su identificador
como la cooperativa autorizada. Si no coincide, no debe devolverlo
ni modificarlo.

No aceptar cambios de cooperativa_id mediante una actualización
genérica del cuerpo de la petición.

## Listados

Un listado privado debe filtrar los datos según la sesión.
El middleware de cooperativa requiere un parámetro en la URL y
no sustituye los filtros de una consulta.

## Respuestas

- 400: identificador de cooperativa inválido.
- 401: falta una sesión válida.
- 403: rol o cooperativa no permitidos.
- 404: recurso inexistente o no encontrado dentro del ámbito autorizado.

## Integración

Los middlewares de roles y cooperativa deben añadirse explícitamente
a cada endpoint privado.

Crear los archivos no protege automáticamente los demás módulos.
Coordinar su incorporación con cada responsable y el líder.

Las rutas públicas de registro y login no requieren sesión.
Las operaciones que modifican datos mediante cookies también deben
mantener protección frente a solicitudes de otros orígenes.

## Estado

- Autenticación integrada en GET /api/usuarios/yo.
- Middleware de roles implementado.
- Middleware de cooperativa implementado.
- Integración en endpoints de otros módulos pendiente.
- Pruebas de permisos pendientes.
## Comprobaciones manuales del frontend

Fecha: 13/10/2026.

Con una cuenta de cliente:

- /admin muestra Acceso denegado.
- /cooperativa muestra Acceso denegado.
- /oficinista muestra Acceso denegado.
- /mis-viajes permite acceder.
- Sin sesión, /mis-viajes redirige a /ingresar.

Resultados confirmados manualmente.

Estas comprobaciones validan la navegación del frontend.
No demuestran todavía la autorización de los endpoints del backend.

## Pendientes de integración

- Aplicar autorización por rol a los endpoints privados de cada módulo.
- Aplicar restricciones y filtros por cooperativa.
- Comprobar respuestas 401 y 403 en las API correspondientes.
- Comprobar rechazo de acceso entre cooperativas distintas.