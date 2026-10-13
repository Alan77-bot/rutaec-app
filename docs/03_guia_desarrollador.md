# Guía del Desarrollador y Despliegue

**Proyecto:** RutaEC — Sistema de Venta de Pasajes Interprovinciales en Ecuador  
**Carrera:** Ingeniería de Software — FISEI — Universidad Técnica de Ambato (UTA)  

---

## 1. Requisitos del Entorno
Para trabajar en el proyecto localmente se requiere:
* **Node.js:** Versión 20.x o superior (`node -v`).
* **npm:** Versión 10.x o superior (`npm -v`).
* **Docker y Docker Compose:** Docker Desktop con soporte WSL2 en Windows o Linux nativo.
* **Git:** Configurado con nombre y correo institucional.

---

## 2. Configuración Inicial (Paso a Paso)

### 1. Clonar el repositorio
```bash
git clone https://github.com/tu-organizacion/rutaec-app.git
cd rutaec-app
git switch develop
```

### 2. Configurar variables de entorno
```bash
cp .env.example .env
cp .env.example backend/.env
```
Edita `.env` si deseas apuntar a una instancia remota de **Neon.tech** o mantén los valores por defecto para Docker local.

---

## 3. Ejecución con Docker Compose (Recomendado)
Docker Compose levanta el contenedor de PostgreSQL (puerto 5433), el Backend API (puerto 3000) y el Frontend Vite (puerto 5173):

```bash
docker compose up --build
```

Para detener los servicios:
```bash
docker compose down
```

---

## 4. Ejecución en Modo Desarrollo (Local sin Contenedores)

### Backend:
```bash
cd backend
npm install
npx prisma generate
npm run dev
```
El servidor backend iniciará en `http://localhost:3000` con recarga en vivo (`tsx watch`).

### Frontend:
```bash
cd frontend
npm install
npm run dev
```
La aplicación web estará disponible en `http://localhost:5173`.

---

## 5. Comandos Útiles de Prisma y Base de Datos
* **Generar cliente de Prisma:**
  ```bash
  cd backend && npx prisma generate
  ```
* **Aplicar migraciones:**
  ```bash
  cd backend && npx prisma migrate dev
  ```
* **Abrir Prisma Studio (Explorador visual de datos):**
  ```bash
  cd backend && npx prisma studio
  ```

---

## 6. Verificación de Código y Calidad (Linter y Tipos)
Antes de enviar cualquier Pull Request:
```bash
# En backend
cd backend && npm run typecheck

# En frontend
cd frontend && npm run build
```
Ambos comandos deben finalizar sin errores tipográficos o de sintaxis TypeScript.
