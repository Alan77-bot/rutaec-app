# Perfil de usuario — seguimiento de #10

Pantalla `/perfil`, accesible desde «Mi perfil» para los cuatro roles.
La identidad procede de la cookie `rutaec_sesion`; ningún endpoint recibe el
identificador del propietario desde el formulario. Se reutilizan `usuarios` y
`tokens_acceso` (propósito `CAMBIAR_CORREO` y columna `nuevo_correo`). Sin migraciones.

Todos los endpoints están bajo `/api/usuarios/perfil`, requieren sesión y heredan
el control de origen y `Cache-Control: no-store` del router de usuarios.

| Método | Ruta relativa | Datos / resultado |
|---|---|---|
| GET | `/` | `{ perfil }`: id, nombres, apellidos, teléfono, correo y documento. Nunca hash ni privilegios. |
| PATCH | `/` | `{ nombres, apellidos, telefono }`; devuelve `{ perfil }`. |
| POST | `/clave` | `{ claveActual, nuevaClave, confirmarClave }`; cierra todas las sesiones. |
| POST | `/correo` | `{ nuevoCorreo, claveActual }`; devuelve mensaje, verificacionId y venceEn. |
| POST | `/correo/confirmar` | `{ verificacionId, codigo }`; cambia el correo y cierra las sesiones. |

El perfil no acepta cambios de rol, cooperativa ni documento. El documento se
muestra solo como consulta; las correcciones documentales se solicitan al
administrador para revisión, sin endpoint de autoservicio en este alcance.

Nombres y apellidos: no vacíos, máximo 100 caracteres tras recortar espacios.
Celular: 10 dígitos, comienza con 09, igual que el registro actual.
Nueva clave: string, mínimo 8 unidades UTF-16 de JavaScript, máximo 72 bytes
UTF-8, confirmación idéntica; bcrypt coste 12. No cambia las contraseñas existentes
ni las políticas de registro/recuperación que se corrigen por separado en #43.

El cambio de correo requiere clave actual y código de seis dígitos enviado al
nuevo correo. Se guarda el código con bcrypt, vence en 15 minutos, pertenece al
usuario y se consume una sola vez. El correo anterior continúa vigente hasta
confirmar. Solicitar otro código invalida el anterior; espera mínima de un
minuto entre solicitudes. Si SMTP falla, se revoca el código y no cambia el correo.
Si el correo ya está ocupado, se rechaza. Se conserva el índice único existente
`usuarios_correo_uq` para resolver también conflictos concurrentes.

Contraseña y correo se coordinan con login/recuperación mediante el bloqueo
`FOR UPDATE` del usuario. Se revalida la sesión dentro de la transacción; el
cambio de contraseña también verifica que las credenciales no cambiaron durante
el cálculo de bcrypt. Tras un cambio sensible se revocan sesiones y tokens
pendientes y se elimina la cookie de sesión del navegador que confirmó.

Límites en memoria por cuenta: 10 solicitudes de cambios sensibles por 15
minutos; confirmación de correo, 5 intentos por 15 minutos. Los límites se
reinician si se reinicia el proceso; para múltiples instancias habrá que
compartir su almacenamiento. El mínimo de un minuto se comprueba en PostgreSQL.

## Pruebas

Con Node 24 y dependencias instaladas:

```text
cd backend
npx prisma generate
npm run build
node --test tests/perfil.test.mjs

cd ../frontend
npm run build
node --test tests/perfil.test.mjs
```

Backend: servicios reales y prueba HTTP del router con Prisma/SMTP sustituidos;
20 pruebas. Frontend: componente y cliente HTTP reales, hooks/contexto/navegación
y fetch sustituidos; 6 pruebas. No es una prueba visual de navegador.

No se ejecutó el flujo con PostgreSQL ni Gmail reales porque Docker Desktop no
estaba disponible durante esta implementación. Antes de declarar aceptado el
flujo completo, comprobar en el entorno de prueba autorizado: persistencia tras
recargar, edición desde cada rol, entrega real del código, código vencido y
reutilizado, correo ocupado, sesión antigua revocada y acceso con la nueva clave
o correo. Probar también competencia con recuperación y aislamiento/rollback
reales: las sustituciones no demuestran las garantías de PostgreSQL.

Si se recarga la pantalla durante el cambio de correo, se debe solicitar otro
código (tras el minuto de espera); el correo anterior permanece vigente.
