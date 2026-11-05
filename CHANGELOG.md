# Historial de versiones

## 0.3.0 — En preparación

### Funcionalidades

- Navegación lateral adaptable por rol y con identidad visual de plataforma o cooperativa.
- Imágenes de buses desde el equipo y distribución de asientos por piso y categoría.
- Llegada estimada de frecuencias y gestión separada de mantenimiento y descansos.
- Venta presencial con datos del comprador, correo opcional y descuentos por pasajero.
- Pagos en efectivo y confirmación de pagos bancarios contrastados en ventanilla.
- Revisiones con imágenes y PDF integrados, filtros, responsables e historial.
- Mejoras en reservas, reportes y descarga e impresión de boletos y comprobantes.

### Correcciones

- Evita reenvíos automáticos innecesarios de códigos de verificación del personal.
- Aplica el color de plataforma al pie general y mantiene la identidad propia de cada cooperativa.

### Actualización

- Aplicar `database/init/rutaec_ventanilla.sql` en bases existentes y regenerar Prisma.
- Docker aplica los scripts de inicialización únicamente a bases nuevas.
- Consultar `docs/07_redisenio_roles.md` para los flujos y la validación.

### Alcance

- La tarjeta es una demostración sin cobro real, habilitada en el entorno local de Docker.
- El comprobante de venta es no fiscal; no incluye integración de facturación electrónica SRI.
- No incluye módulo de chofer.

### Publicación

La versión se publica después de revisar e integrar la release en `main`. El tag
anotado `v0.3.0` debe apuntar al commit de integración en `main`. Las correcciones y
el ajuste de versiones regresan a `develop` mediante el segundo PR de la release.
No eliminar la rama release hasta integrar ambos PR.
