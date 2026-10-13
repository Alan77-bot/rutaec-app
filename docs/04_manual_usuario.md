# Manual de Usuario y Roles del Sistema

**Proyecto:** RutaEC — Sistema de Venta de Pasajes Interprovinciales en Ecuador  
**Carrera:** Ingeniería de Software — FISEI — Universidad Técnica de Ambato (UTA)  

---

## 1. Introducción
RutaEC cuenta con un control de acceso basado en roles (RBAC) que garantiza la seguridad y segregación de funciones entre los distintos actores de la transportación interprovincial en Ecuador.

---

## 2. Roles del Sistema y Funcionalidades

### 👤 1. Administrador General
* **Gestión de Cooperativas:** Alta, baja y edición de cooperativas de transporte legalmente constituidas.
* **Asignación de Resoluciones ANT:** Registro de resoluciones oficiales de la Agencia Nacional de Tránsito.
* **Auditoría Global:** Consulta de eventos del sistema (quién modificó qué registro y cuándo).
* **Configuración Global:** Parámetros del sistema y políticas de descuento nacionales.

### 🏢 2. Gerente de Cooperativa
* **Identidad Institucional:** Personalización del nombre comercial, logotipo, colores primarios/secundarios y enlaces de redes sociales.
* **Gestión de Flota:** Registro de buses (placa, chasis, carrocería, año, capacidad y fotografías).
* **Distribución de Asientos:** Configuración del mapa de asientos para unidades de 1 o 2 pisos (asientos Normales, VIP y Preferenciales).
* **Personal:** Registro y control de oficinistas asignados a su cooperativa.
* **Hojas de Ruta:** Asignación de buses a frecuencias y programación de días de parada para mantenimiento.

### 💼 3. Oficinista de Ventas y Validación
* **Venta en Ventanilla:** Emisión directa de boletos para pasajeros que compran en terminales terrestres.
* **Bandeja de Validación de Pagos:** 
  * Visualización de transferencias o depósitos bancarios cargados por clientes.
  * Revisión del comprobante (monto, número de referencia bancaria y comprobante adjunto).
  * Aprobación o rechazo con motivo documentado.
* **Resolución de Incidencias:** Tramitación de solicitudes de anulación o reprogramación de boletos.

### 🎟️ 4. Pasajero / Cliente Final
* **Búsqueda Inteligente:** Búsqueda por terminal de origen, destino y fecha.
* **Filtros Avanzados:** Filtrado por cooperativa, tipo de asiento (Normal/VIP), características del chasis/carrocería y viajes directos o con escalas.
* **Paradas Intermedias:** Compra de boletos en tramos intermedios (ej. Latacunga $\rightarrow$ Cuenca en la ruta Quito $\rightarrow$ Loja).
* **Selección Visual de Asientos:** Mapa interactivo con bloqueo temporal de 5 minutos por el servidor.
* **Descuentos de Ley:** Aplicación de tarifas preferenciales (tercera edad, menor de edad, carnet de discapacidad) validando la cédula ecuatoriana.
* **Boleto Digital:** Descarga de boletos en formato PDF con código QR y consulta en el historial de compras en cualquier momento.

### 🚍 5. Personal del Bus (Chofer o Ayudante)
* **Control de Abordaje:** Acceso al módulo de escaneo de boletos mediante la cámara web o del dispositivo móvil (`/chofer/escanear`).
* **Verificación en Tiempo Real:** Validación del código QR del pasajero al momento de subir a la unidad.
* **Prevención de Fraudes:** El sistema marca el boleto como `ABORDADO`, impidiendo que un mismo boleto sea utilizado dos veces.
