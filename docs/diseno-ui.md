# Diseño compartido de RutaEC

Todos los roles usan la tipografía DM Sans y las mismas reglas de formularios, botones, tablas y diálogos. La base está en `frontend/src/styles/sistema-ui.css`, importada después de los estilos anteriores en `main.tsx`.

Las variables `--ui-marca` y `--ui-sobre-marca` utilizan la personalización de cooperativa cuando existe; en la vista general y en administración usan la marca de la plataforma. La identidad cambia los colores, no el diseño de los controles. Los colores semánticos de error, advertencia, éxito y categorías de asiento conservan su significado.

Los diálogos de administración, flota, oficinistas, asientos, personalización, detalle de viaje y avisos usan `components/ui/Dialogo.jsx`. Los formularios y acciones permanecen en cada módulo; el contenedor compartido establece fondo, tamaño, esquinas, scroll y presentación. Se monta fuera del contenido animado y dentro del tema activo mediante un portal.

El diálogo bloquea el scroll de fondo y mantiene el foco dentro de la ventana. Escape utiliza el botón de cerrar o cancelar existente, respetando si está deshabilitado. Al cerrar recupera el foco anterior. El módulo de oficinistas conserva su gestión propia de foco y bloqueo para evitar duplicar sus eventos.

Para pantallas nuevas, reutilizar el contenedor y las clases comunes de botones (`btn`, `btn-oscuro`, `btn-claro`, `btn-danger`) y las etiquetas HTML de tabla y formulario. Evitar nuevas tipografías, colores de marca fijos y contenedores de modal independientes.

Los estilos anteriores de los módulos se mantienen para sus distribuciones particulares. Las reglas compartidas normalizan su presentación durante la migración y tienen prioridad sobre los estilos antiguos escritos directamente en los elementos.
