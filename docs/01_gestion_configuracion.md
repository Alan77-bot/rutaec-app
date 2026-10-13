# Plan de Gestión de la Configuración del Software (GCS)

**Proyecto:** RutaEC — Sistema de Venta de Pasajes Interprovinciales en Ecuador  
**Asignatura:** Manejo y Configuración de Software  
**Carrera:** Ingeniería de Software — FISEI — Universidad Técnica de Ambato (UTA)  

---

## 1. Introducción y Objetivos de GCS
El propósito de este plan es establecer las directrices, herramientas y procedimientos para gestionar la configuración del software durante todo el ciclo de vida del proyecto RutaEC. Asegura la trazabilidad, integridad y calidad del código fuente, modelos de datos, documentación y entregables del equipo colaborativo.

---

## 2. Elementos de Configuración del Software (SCIs)
Se identifican y controlan los siguientes ítems de configuración:
1. **Código Fuente:** Frontend (React/TypeScript), Backend (Express/TypeScript).
2. **Esquema de Base de Datos:** `schema.prisma` y scripts SQL de inicialización en `database/init/`.
3. **Documentación:** Requisitos, arquitectura, guías de desarrollo y manuales de usuario.
4. **Infraestructura como Código (IaC):** `compose.yaml`, `Dockerfile` de backend y frontend.
5. **Configuración de Control de Versiones:** Plantillas de GitHub (`.github/`), `CITATION.cff` y `LICENSE`.

---

## 3. Estrategia de Ramas: Flujo Gitflow
Se adopta el modelo **Gitflow** adaptado al trabajo en equipo:

```
[main]          --------------------● v0.1.0 (Producción / Entrega estable)
                      \            /
[release/0.1.0]        \----●-----/
                            /
[develop]       ---●-------●-------●-------● (Integración continúa)
                    \     /         \     /
[feature/xxx]        ●---●           ●---● (Tareas individuales por módulo)
```

* **`main`**: Rama protegida que contiene únicamente versiones estables listas para producción y demostración. Cada versión se etiqueta con un `tag` (ej. `v0.1.0`).
* **`develop`**: Rama base para el desarrollo del equipo donde se integran los Pull Requests aprobados.
* **`feature/<issue_id>-<nombre>`**: Ramas temporales creadas a partir de `develop` para implementar funcionalidades específicas.
* **`hotfix/<issue_id>-<nombre>`**: Ramas urgentes creadas desde `main` para corregir fallos críticos detectados en entregas.

---

## 4. Política de Commits y Pull Requests

### Convención de Commits (Conventional Commits)
Cada commit debe seguir la estructura:
`tipo(módulo): descripción corta (#issue)`
* `feat`: Nueva funcionalidad (ej: `feat(buses): agregar editor de asientos por piso (#12)`)
* `fix`: Corrección de error (ej: `fix(pagos): validar comprobante duplicado (#34)`)
* `docs`: Cambios en documentación (ej: `docs(gcs): actualizar plan de configuracion (#05)`)
* `refactor`: Reestructuración de código sin alterar funcionalidad.

### Política de Revisión (Dos Revisores Independientes)
* Queda **prohibido el push directo** a `main` y `develop`.
* Todo cambio se integra mediante un **Pull Request (PR)** hacia `develop`.
* Cada PR requiere obligatoriamente **dos aprobaciones independientes** (distintas del autor) antes del merge.
* El PR debe completar la plantilla `.github/PULL_REQUEST_TEMPLATE.md` enlazando el issue correspondiente, evidencias de prueba y cambios en base de datos.

---

## 5. Control de Cambios con Jira Service Management

### Comité de Control de Cambios (CCB - Change Control Board)
El CCB está conformado por 2 integrantes del equipo (I1 e I6) y tiene las siguientes funciones:
* Evaluar el impacto técnico y funcional de cada Petición de Cambio (RFC - Request For Change).
* Aprobar, rechazar o postergar cambios en la línea base del sistema.

### Ciclo de Vida de una Petición de Cambio
$$\text{Solicitud (RFC)} \longrightarrow \text{Evaluación de Impacto} \longrightarrow \text{Aprobación CCB} \longrightarrow \text{Rama Feature} \longrightarrow \text{PR \& QA} \longrightarrow \text{Cierre / Auditoría}$$

1. **Registro:** El solicitante abre un ticket de "Solicitud de Cambio" en Jira Service Management.
2. **Evaluación:** El CCB analiza si el cambio afecta la arquitectura, la base de datos o el cronograma.
3. **Decisión:** El ticket pasa a estado *Aprobado* o *Rechazado*.
4. **Implementación:** El desarrollador asignado crea la rama `feature/` referenciando el ID de Jira.
5. **Auditoría:** Se genera un **Dashboard en Jira** con métricas de cambios aprobados, cerrados y rechazados para la auditoría de configuración.
