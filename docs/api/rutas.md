# Catálogo y creación de rutas

Las ciudades y terminales pertenecen al catálogo de la base. El gerente no las crea desde el formulario de rutas.

`database/init/rutaec_catalogo.sql` carga ocho ciudades de Ecuador y ocho puntos de embarque referenciales llamados `Terminal de prueba - Ciudad`. Sus direcciones se identifican como datos de desarrollo; no son terminales oficiales verificadas. Se debe completar el catálogo con datos reales antes de operar. La carga es transaccional e idempotente y no cambia registros existentes.

Docker Compose aplica el catálogo al inicializar una base nueva. Para bases existentes se debe ejecutar el SQL una vez, sin eliminar el volumen. La base local ya recibió esta carga.

El gerente entra a **Mi panel → Rutas → Nueva ruta**. El formulario usa el modal compartido y permite elegir terminales, agregar paradas intermedias y establecer minutos acumulados desde el origen. La primera parada tiene cero minutos, los tiempos siguientes deben aumentar, no se repiten terminales y el origen y destino deben estar en ciudades distintas.

La API de creación y modificación solo permite el rol `cooperativa` (gerente). Al crear toma `cooperativa_id` de la sesión, no del formulario. Al modificar comprueba que la ruta pertenezca a esa misma cooperativa. El listado del gerente se filtra en la consulta de base de datos; el administrador puede consultar el conjunto de rutas, pero no crearlas ni modificarlas. Clientes y oficinistas utilizan los viajes publicados, no esta gestión.

Crear una ruta no publica viajes ni habilita ventas. Después se configuran las frecuencias y sus requisitos y se programan los viajes desde las pantallas existentes de frecuencias y programación.
