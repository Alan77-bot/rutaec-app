# Personalización de cooperativas

Cada cooperativa conserva sus colores, contacto, redes y logo en su registro existente. La fotografía de portada se referencia con la clave interna `portada_archivo_id` de `redes_sociales`; el cliente no puede enviar esa clave. No se necesita una migración de base de datos.

## API

- `GET /api/cooperativas/:id/personalizacion`: identidad pública para portal y paneles.
- `PATCH /api/cooperativas/:id/personalizacion`: requiere sesión de gerente (`cooperativa`) y coincidencia con `sesion.coopId`. Los oficinistas no pueden modificarla. No admite nombres, RUC, propietario ni estado.
- `GET /api/cooperativas/:id/personalizacion/imagenes/:archivoId`: sirve exclusivamente imágenes públicas disponibles de esa cooperativa, nunca comprobantes ni documentos privados.

Campos admitidos: `color_primario`, `color_secundario`, `correo`, `telefono`, `direccion`, `sitio_web`, `facebook`, `instagram`, `whatsapp`, `logo`, `fotografia`. Los colores deben tener formato `#RRGGBB`; los enlaces deben usar HTTP o HTTPS. Correo, teléfono y dirección no pueden quedar vacíos.

Las imágenes nuevas se envían como data URL y se guardan como archivos con UUID y metadatos en `archivos`. Límite de 2 MB por imagen. Logo PNG/JPG para compatibilidad con PDF; portada PNG/JPG/WEBP. Una cadena vacía quita la imagen; la URL actual permite conservarla. Los archivos anteriores se conservan para referencias de boletos ya emitidos. Si falla la transacción se eliminan los archivos nuevos.

`PERSONALIZACION_DIR` configura el directorio persistente. En desarrollo se utiliza `backend/storage/personalizacion` al ejecutar desde backend. Docker Compose monta un volumen en `/var/lib/rutaec/personalizacion`.

## Interfaz

El formulario guarda mediante la API y aplica el resultado inmediatamente al gerente. Los paneles del personal consultan su propia cooperativa al iniciar sesión, cada 15 segundos con la pestaña visible y al recuperar el foco. El administrador utiliza la marca general. La selección pública nunca sustituye la cooperativa asignada al gerente u oficinista.

El inicio `/` redirige al administrador a `/admin`, al gerente a `/cooperativa` y al oficinista a `/oficinista`. Solo clientes y visitantes ven el portal de ventas. El oficinista puede acceder a búsquedas para realizar ventas de su cooperativa.

Clientes y visitantes pueden seleccionar una cooperativa activa o comparar todas desde el selector del portal. La selección se conserva durante la navegación y la sesión del navegador, y puede compartirse mediante `?cooperativa=UUID`. `?cooperativa=todas` recupera la marca general. En el espacio seleccionado se aplican logo, colores, portada y datos de contacto; se oculta la promoción dirigida a nuevas cooperativas. El pie de página muestra sus enlaces oficiales y sus datos de contacto. No se utiliza esta selección como autorización del backend.

Las APIs `GET /api/reservas/portada`, `/viajes` y `/ciudades` aceptan el filtro opcional `cooperativa=UUID`. La validación rechaza identificadores incorrectos o parámetros repetidos; las consultas utilizan parámetros SQL y filtran por la cooperativa antes de calcular ciudades, destinos y frecuencias. Sin ese filtro conservan la búsqueda general.

El portal muestra la identidad en las cooperativas con viajes publicados que devuelve su portada. Los boletos consultados muestran colores, logo y contacto actuales de su cooperativa; se conservan los datos originales del viaje, pasajero e importes. Los PDF enviados por correo utilizan la identidad registrada al emitir el boleto.

## Verificación manual

1. Iniciar sesión con un gerente A y cambiar colores, logo, portada y contacto; guardar y recargar.
2. Entrar con un oficinista A en otro navegador: comprobar su identidad y actualizar desde el gerente; debe recibirla en 15 segundos o al volver a la ventana.
3. Entrar con personal B: su identidad debe permanecer igual.
4. Intentar PATCH a la cooperativa B como gerente A, o PATCH como oficinista A: esperar 403.
5. Abrir el portal con viajes publicados de A y un boleto de A, descargar el PDF y comprobar su marca.
6. Quitar imágenes, guardar y recargar; comprobar que desaparecen. Simular fallo de red al guardar: el formulario debe conservar los cambios y mostrar el error.
7. Como visitante elegir una cooperativa desde el selector, comprobar menú, portada, pie y búsqueda; recargar y comprobar que se mantiene la selección. Cambiar a todas y comprobar que vuelve la marca general.
8. Como administrador, gerente y oficinista abrir `/`: debe redirigir al panel correspondiente. Agregar `?cooperativa=UUID_DE_OTRA` no debe cambiar su identidad ni sus permisos.
