# Plazos de revisión y corrección

Reglas de la entrega confirmadas por el equipo: revisión en 24 horas, corrección en 24 horas y asignación exclusiva durante 30 minutos. No se presentan como plazos legales de Ecuador.

Variables opcionales del backend: `REVISION_PLAZO_HORAS`, `CORRECCION_PLAZO_HORAS`, `REVISION_ASIGNACION_MINUTOS`. Los valores iniciales son 24, 24 y 30. La política se conserva por revisión en `eventos_salida`; reiniciar el servidor no renueva el plazo ya registrado. Los trámites anteriores a la activación reciben un plazo inicial desde esa activación, sin vencimiento retroactivo inmediato.

El proceso recorre las revisiones cada minuto y también comprueba los plazos al tomar, decidir o corregir. La asignación vencida, o de un usuario desactivado, vuelve a la bandeja disponible. Se conserva un evento con el revisor anterior, fecha y motivo de sistema, sin atribuirle una acción humana ficticia. Liberar la asignación no rechaza el pago.

Si vence la revisión o corrección de un pago, una compra pendiente pasa a incidencia y libera el asiento. Se abre conciliación manual y se avisa al cliente. No se considera verificado un ingreso por este vencimiento y no se devuelve dinero automáticamente. Confirmar posteriormente no puede recuperar silenciosamente el asiento: debe resolverse la incidencia, una nueva reserva aceptada o el reembolso correspondiente. Las validaciones documentales fuera de plazo generan aviso y siguen disponibles para atención, sin retener asientos.

`GET /api/pagos/revisiones/plazos/:compraId` permite al titular o personal autorizado consultar los vencimientos. La bandeja incluye plazos e historial del sistema. Los eventos de aviso se entregan con el PR de notificaciones #50.

No requiere migraciones ni cambios del esquema. Las pruebas funcionales, de concurrencia y con Docker/PostgreSQL/Gmail quedan pendientes para la etapa final. La compilación no acredita esos resultados.
