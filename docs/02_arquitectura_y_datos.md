# Arquitectura del Sistema y Modelo de Datos

**Proyecto:** RutaEC — Sistema de Venta de Pasajes Interprovinciales en Ecuador  
**Carrera:** Ingeniería de Software — FISEI — Universidad Técnica de Ambato (UTA)  

---

## 1. Visión General de la Arquitectura
RutaEC implementa una arquitectura desacoplada basada en capas, diseñada para escalabilidad, mantenibilidad y separación estricta de responsabilidades:

```
[ Cliente Web / Móvil ]
      (React + Vite + Tailwind CSS 4)
                  │
             HTTP / JSON (REST API)
                  │
      ▼
[ Servidor API Backend ]
      (Node.js + Express + TypeScript)
      ├── Middlewares (Auth, Roles, Multer, Errores)
      ├── Módulos de Negocio (usuarios, cooperativas, buses, frecuencias, reservas, pagos, boletos)
      └── Servicios Compartidos (Auditoría, Notificaciones, QR, PDF)
                  │
             Prisma ORM Client
                  │
      ▼
[ Base de Datos Relacional ]
      PostgreSQL 18 (Local con Docker / Nube con Neon.tech)
      (Esquema: rutaec)
```

---

## 2. Capas y Módulos de la Aplicación

### Frontend (`frontend/src/modules/`)
* **`administracion`**: Panel para configuración global y altas de cooperativas.
* **`cooperativas`**: Perfil institucional, logos, colores y sucursales.
* **`buses`**: Flota, chasis, carrocerías y distribución interactiva de asientos (1 y 2 pisos).
* **`horarios` / `rutas`**: Catálogo de frecuencias y paradas intermedias.
* **`reservas`**: Buscador con filtros, selección visual de asientos y temporizador de retención (5 min).
* **`pagos`**: Carga de comprobantes de depósito y pasarela en sandbox.
* **`boletos`**: Visualización de boletos emitidos y descarga en formato PDF.
* **`chofer`**: Lector de cámara web/móvil para escaneo y validación de boletos QR al abordar.

### Backend (`backend/src/modules/`)
Cada módulo contiene su propio `routes.ts`, `controller.ts` y `service.ts`, asegurando un bajo acoplamiento.

---

## 3. Modelo de Datos Relacional (PostgreSQL + Prisma)

El esquema de base de datos se encuentra definido en el espacio de nombres `rutaec` con las siguientes entidades principales:

### Entidades Principales y Relaciones
1. **`cooperativas`**: Identidad legal (RUC, razón social, nombre comercial, colores institucionales y logo).
2. **`buses`**: Placa, número de unidad, chasis, carrocería, capacidad y relación con `cooperativa`.
3. **`asientos_bus`**: Distribución física por piso, fila, columna y categoría (Normal, VIP, Preferencial).
4. **`resoluciones` & `frecuencias`**: Frecuencias autorizadas por la Agencia Nacional de Tránsito (ANT) con origen, destino, horario y días de vigencia.
5. **`paradas_ruta` & `paradas_viaje`**: Permite la venta tramo a tramo (ej. Latacunga $\rightarrow$ Cuenca en la ruta Quito $\rightarrow$ Loja).
6. **`compras` & `detalle_compra`**: Registro de venta con temporizador de expiración atómica (`vence_en`).
7. **`pasajeros` & `politicas_descuento`**: Cédula ecuatoriana, fecha de nacimiento y descuentos legales (tercera edad, menor de edad, discapacidad).
8. **`pagos` & `comprobantes_pago`**: Estados de pago (`PENDIENTE`, `EN_REVISION`, `APROBADO`, `RECHAZADO`).
9. **`boletos`**: Código único UUID, token para código QR y estado (`EMITIDO`, `ABORDADO`, `ANULADO`).
10. **`auditoria`**: Registro inmutable de eventos del sistema (actor, acción, fecha, entidad y estado anterior/nuevo).
