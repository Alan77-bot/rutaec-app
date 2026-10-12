# Guía de contribución — RutaEC

## 1. Organización del equipo

RutaEC es un proyecto universitario desarrollado por seis integrantes. Uno de ellos cumple la función de jefe del equipo y coordina la integración de los cambios.

Cada integrante debe clonar el repositorio, revisar sus tareas asignadas y trabajar únicamente en las ramas correspondientes.

## 2. Flujo de trabajo Gitflow

Utilizaremos las siguientes ramas:

- `main`: contiene las versiones estables del proyecto.
- `develop`: integra las funcionalidades aprobadas.
- `feature/*`: se utiliza para desarrollar tareas individuales.
- `release/*`: prepara las entregas.
- `hotfix/*`: corrige errores urgentes de versiones estables.

Antes de comenzar una tarea, debe registrarse un Issue en GitHub.

## 3. Desarrollo de funcionalidades

Cada integrante debe crear su rama `feature/*` desde `develop`, implementar su tarea y realizar commits claros y específicos.

Formato de commits:

`tipo(modulo): descripcion del cambio`

Ejemplos:

- `feat(buses): agrega registro de buses`
- `fix(reservas): corrige validacion de asientos`
- `docs(instalacion): actualiza guia del proyecto`
- `chore(docker): configura contenedores`

## 4. Pull Requests

Las ramas de funcionalidades deben integrarse mediante Pull Requests hacia `develop`.

Cada PR debe contar con dos revisores independientes, diferentes del autor y de quienes hayan colaborado directamente en ese cambio.

Ambos revisores deben aprobar la versión final del PR. Si se realizan modificaciones posteriores, se requiere revisar nuevamente los cambios afectados.

El jefe coordina la integración. Si el jefe es el autor del PR, otro integrante autorizado realiza la integración.

## 5. Reglas de protección

- No se permiten cambios directos a `main` ni a `develop`.
- No se permite `force push` sobre estas ramas.
- No se integran PR sin las dos aprobaciones requeridas.
- No se deben subir contraseñas, archivos `.env` reales ni datos personales.
- Cada entrega estable debe identificarse mediante tags y releases.

Estas son reglas del equipo y se reforzarán mediante la configuración de protección de ramas cuando esté disponible.

## 6. Control de cambios

Las revisiones de Pull Requests forman parte del trabajo colaborativo habitual.

El comité de control de cambios y las solicitudes formales de cambios se implementarán después de la primera presentación. Son procesos diferentes de las revisiones actuales de PR.