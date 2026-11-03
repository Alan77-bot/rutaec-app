const BASE_URL = "/api/buses";

async function solicitar(ruta, opciones = {}) {
  let respuesta;

  try {
    respuesta = await fetch(`${BASE_URL}${ruta}`, {
      credentials: "include",
      ...opciones,
      headers: {
        ...(opciones.body ? { "Content-Type": "application/json" } : {}),
        ...opciones.headers,
      },
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor.");
  }

  const resultado = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    throw new Error(
      resultado?.error ?? "No se pudo completar la operación."
    );
  }

  return resultado;
}

export const busesService = {
  async listar() {
    const resultado = await solicitar("/");
    return resultado.datos;
  },

  async listarGrupos() {
    const resultado = await solicitar("/grupos");
    return resultado.datos;
  },

  async registrar(datos) {
    const resultado = await solicitar("/", {
      method: "POST",
      body: JSON.stringify(datos),
    });

    return resultado.datos;
  },


  async editar(id, datos) {
  const resultado = await solicitar(`/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(datos),
  });

  return resultado.datos;
},

};
