# RutaEC 🚌
> **Plataforma Web para la Gestión y Venta de Pasajes Interprovinciales en Ecuador**

[![Estado del Proyecto](https://img.shields.io/badge/estado-en%20desarrollo-blue.svg)](#)
[![Licencia](https://img.shields.io/badge/licencia-MIT-green.svg)](./LICENSE)
[![Universidad](https://img.shields.io/badge/UTA-FISEI-red.svg)](https://fisei.uta.edu.ec/)

---

## 📌 Información Académica e Institucional
* **Institución:** Universidad Técnica de Ambato (UTA)
* **Facultad:** Facultad de Ingeniería en Sistemas, Electrónica e Industrial (FISEI)
* **Carrera:** Software
* **Asignatura:** Manejo y Configuración de Software
* **Proyecto:** Segundo Parcial — Simulación de Gestión de la Configuración y Control de Cambios en Desarrollo Colaborativo

---

## 👥 Integrantes del Equipo
| Rol en el Proyecto | Responsabilidad Principal | Módulo Funcional |
| :--- | :--- | :--- |
| **I1 - Jefe de Proyecto** | Arquitectura base, autenticación, admin y auditoría | `auth`, `administracion`, Docker |
| **I2 - Desarrollador** | Cooperativas, personalización de marca y flota de buses | `cooperativas`, `buses` |
| **I3 - Desarrollador** | Frecuencias ANT, tarifas por tramo y reportes operativos | `frecuencias`, `horarios`, `rutas` |
| **I4 - Desarrollador** | Experiencia de cliente, reservas concurrentes y descuentos | `reservas`, `cliente` |
| **I5 - Desarrollador** | Oficinista, revisión de pagos y transferencias | `oficina`, `pagos` |
| **I6 - Desarrollador** | Emisión de boletos, generación de QR/PDF y notificaciones | `boletos`, `chofer`, CI/CD |

---

## 🛠️ Stack Tecnológico
* **Frontend:** React + Vite + TypeScript + Tailwind CSS 4 + React Router
* **Backend:** Node.js + Express + TypeScript
* **ORM & Base de Datos:** Prisma 7 + PostgreSQL 18 (Soporte local en Docker Compose y nube en Neon)
* **Control de Versiones & GCS:** Git, GitHub, Gitflow, Jira Service Management (Comité de Control de Cambios - CCB)
* **Contenedores:** Docker & Docker Compose

---

## 🚀 Puesta en Marcha Rápida (Entorno Local)

### Requisitos Previos
* [Docker Desktop](https://www.docker.com/) instalado y en ejecución.
* [Node.js](https://nodejs.org/) v20+ y `npm`.

### 1. Clonar el repositorio
```bash
git clone https://github.com/tu-usuario/rutaec-app.git
cd rutaec-app
```

### 2. Configurar Variables de Entorno
Copia el archivo de ejemplo a `.env` tanto en la raíz como en backend:
```bash
cp .env.example .env
cp .env.example backend/.env
```

### 3. Levantar con Docker Compose
```bash
docker compose up --build
```
* **Frontend:** [http://localhost:5173](http://localhost:5173)
* **Backend API:** [http://localhost:3000](http://localhost:3000)
* **PostgreSQL:** `localhost:5433`

---

## 📚 Documentación del Proyecto
Para conocer más sobre el diseño, procesos y manuales, consulta la carpeta [`docs/`](./docs/):
1. [01. Plan de Gestión de la Configuración y Flujo Git](./docs/01_gestion_configuracion.md)
2. [02. Arquitectura del Sistema y Modelo de Datos](./docs/02_arquitectura_y_datos.md)
3. [03. Guía del Desarrollador y Despliegue](./docs/03_guia_desarrollador.md)
4. [04. Manual de Usuario y Roles](./docs/04_manual_usuario.md)

---

## 📄 Licencia y Citación
* Consulta el archivo [LICENSE](./LICENSE) para conocer los términos de uso.
* Para citar este proyecto en trabajos académicos, consulta [CITATION.cff](./CITATION.cff).
