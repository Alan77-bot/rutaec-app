
const BASE_URL = "/api/buses";

// ========================================
// FUNCIÓN GENERAL PARA PETICIONES
// ========================================

async function solicitar(ruta, opciones = {}) {
  let respuesta;

  try {
    respuesta = await fetch(`${BASE_URL}${ruta}`, {
      credentials: "include",
      ...opciones,
      headers: {
        ...(opciones.body
          ? { "Content-Type": "application/json" }
          : {}),
        ...opciones.headers,
      },
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor.");
  }

  const resultado = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    throw new Error(
      resultado?.error ??
        "No se pudo completar la operación."
    );
  }

  return resultado;
}

// ========================================
// SERVICIO DE BUSES
// ========================================

export const busesService = {

  // Consultar distribución de asientos
  async consultarAsientos(id, cooperativaId) {
    const query = cooperativaId
      ? `?cooperativaId=${encodeURIComponent(cooperativaId)}`
      : "";

    const resultado = await solicitar(
      `/${encodeURIComponent(id)}/asientos${query}`
    );

    return resultado?.datos;
  },

  // Guardar distribución de asientos
  async guardarAsientos(id, asientos, cooperativaId) {
    const query = cooperativaId
      ? `?cooperativaId=${encodeURIComponent(cooperativaId)}`
      : "";

    const resultado = await solicitar(
      `/${encodeURIComponent(id)}/asientos${query}`,
      {
        method: "PUT",
        body: JSON.stringify({ asientos }),
      }
    );

    return resultado?.datos;
  },

  // Consultar buses de la cooperativa
  async listar() {
    const resultado = await solicitar("/");
    return resultado?.datos ?? [];
  },

  // Consultar grupos disponibles
  async listarGrupos() {
    const resultado = await solicitar("/grupos");
    return resultado?.datos ?? [];
  },

  // Consultar catálogo de comodidades
  async listarComodidades() {
    const resultado = await solicitar("/comodidades");
    return resultado?.datos ?? [];
  },

  // Registrar bus con sus comodidades
  async registrar(datos) {
    const resultado = await solicitar("/", {
      method: "POST",
      body: JSON.stringify(datos),
    });

    return resultado?.datos;
  },

  // Editar bus y sus comodidades
  async editar(id, datos) {
    const resultado = await solicitar(
      `/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify(datos),
      }
    );

    return resultado?.datos;
  },

  // Cambiar estado:
  // ACTIVO | INACTIVO | MANTENIMIENTO
  async cambiarEstado(id, estado) {
    const estadosPermitidos = [
      "ACTIVO",
      "INACTIVO",
      "MANTENIMIENTO",
    ];

    if (!estadosPermitidos.includes(estado)) {
      throw new Error("El estado del bus no es válido.");
    }

    const resultado = await solicitar(
      `/${encodeURIComponent(id)}/estado`,
      {
        method: "PATCH",
        body: JSON.stringify({ estado }),
      }
    );

    return resultado?.datos;
  },
};