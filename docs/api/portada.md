# Portada de viajes

`GET /api/reservas/portada?origen=Ambato&fecha=AAAA-MM-DD` es público. Reutiliza la validación de fechas y las reglas de viajes vendibles de la búsqueda. Devuelve ciudades y cooperativas con viajes publicados y ventas abiertas, número de frecuencias disponibles y destinos con su tarifa mínima publicada para el origen y fecha indicados.

La portada consulta este endpoint directamente: no depende del contexto antiguo en modo de vista previa. Sus selectores muestran ciudades reales, los destinos respetan la fecha seleccionada y la ausencia de tarifas no se presenta como un precio de cero dólares. Incluye estados de carga, error con reintento y ausencia de viajes. Conserva el diseño visual existente. Las imágenes y textos de destinos son elementos de presentación; los destinos y precios vendibles proceden de PostgreSQL.

La sección turística no ofrece compras ficticias: remite a la cooperativa hasta disponer de ese servicio real. No modifica los paneles ni la gestión de buses del líder.

Con `RUTAEC_TEST_DB=1`, `portada.integration.test.ts` comprueba datos reales, tarifa mínima, fecha sin resultados y rechazo de parámetros inválidos. Requiere una base QA con el script de viajes ficticios del repositorio. No necesita migraciones.
