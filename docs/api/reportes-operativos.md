# Reporte operativo

`GET /api/reportes-operativos?desde=AAAA-MM-DD&hasta=AAAA-MM-DD` consulta hasta un año, incluyendo ambos días en la zona `America/Guayaquil`. Requiere sesión de oficinista, gerente o administrador. El personal únicamente consulta su cooperativa; el administrador puede filtrar con `cooperativaId`.

Devuelve compras por estado, pagos por método/estado y modo de demostración, cobros efectivos, devoluciones por estado, devoluciones realizadas, tiempos medios de revisión, viajes y ocupación por segmento consecutivo. La lectura utiliza una transacción de instantánea consistente.

Las compras se filtran por creación; los ingresos, por recepción; los reembolsos efectivos, por realización; la ocupación, por salida del viaje. Los cobros con incidencia se distinguen de reservas y deben conciliarse. Los pagos de demostración no se suman a ingresos ni devoluciones reales. La ocupación incluye hasta 1000 segmentos: reducir el período si se alcanza ese límite.

La pantalla `/reporte-operativo` ofrece filtros y exportación CSV de cada tabla, sin datos documentales de los pasajeros. No crea registros ni cambia la base de datos. Requiere los PR de programación y reservas para disponer de datos operativos.

Las pruebas con datos reales y la conciliación del reporte quedan pendientes para el final. La comprobación de compilación no sustituye estas pruebas.
