# Pruebas manuales de registro y verificación

- Proyecto: RutaEC
- Responsable: Integrante 2
- Issue: #9
- Rama: feature/9-registro
- Fecha: 13/10/2026
- Entorno: frontend y backend locales; PostgreSQL en Neon.
- Correo: Gmail mediante Nodemailer.

## Resultados

| Caso | Resultado esperado | Resultado observado |
|---|---|---|
| Registro con datos nuevos | Crear cuenta pendiente de verificación | Correcto |
| Envío de correo | Recibir un código de seis dígitos | Correcto |
| Código válido | Verificar el correo y permitir iniciar sesión | Correcto |
| Inicio de sesión después de verificar | Acceder con la cuenta creada | Correcto |
| Acceso antes de verificar | Rechazar el inicio de sesión | Correcto |
| Reenvío de código | Enviar un nuevo código | Correcto |
| Código anterior después del reenvío | Rechazar el código anterior | Correcto |
| Registro duplicado | Rechazar la creación de otra cuenta | Correcto |

## Persistencia comprobada

- La cuenta se registra en usuarios con rol CLIENTE.
- correo_verificado_en se completa al confirmar el código.
- El código se almacena como hash en tokens_acceso.
- consumido_en se completa al utilizar correctamente el código.

## Evidencias

Adjuntar las capturas tomadas durante las pruebas:

1. Cuenta pendiente de verificación.
2. Confirmación de correo verificado.
3. Inicio de sesión con la cuenta nueva.
4. Consultas de persistencia en Neon.
5. Acceso rechazado antes de verificar.
6. Reenvío del código.
7. Rechazo del código anterior.
8. Rechazo del registro duplicado.

No incluir contraseñas, códigos vigentes, cookies ni credenciales.

## Pendientes

Estas pruebas fueron manuales.

Quedan pendientes las comprobaciones específicas de vencimiento,
límites de intentos, fallos de envío y concurrencia.
Las pruebas pendientes del login se documentan por separado en la issue #10.