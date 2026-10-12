# Política de seguridad — RutaEC

## Reporte de vulnerabilidades

Si un integrante identifica un problema de seguridad, debe comunicarlo de manera privada al responsable del proyecto o jefe del equipo.

No se deben publicar detalles sensibles de vulnerabilidades en Issues públicos ni en comentarios de Pull Requests.

## Protección de información

Está prohibido incluir en commits, Issues o documentación pública:

- Contraseñas y claves de acceso.
- Tokens de autenticación.
- Archivos `.env` con credenciales reales.
- Claves privadas y certificados sensibles.
- Documentos de identidad de personas reales.
- Comprobantes bancarios reales.
- Datos personales utilizados sin autorización.

Las configuraciones se compartirán mediante archivos `.env.example` sin secretos.

## Base de datos

RutaEC utilizará PostgreSQL en Neon y entornos locales mediante Docker.

Las credenciales deben mantenerse privadas. Los cambios de estructura deberán probarse previamente y coordinarse con el responsable de la base de datos.

## Incidentes

Ante una posible filtración de credenciales, se debe informar inmediatamente al jefe del equipo para coordinar su revocación y reemplazo.