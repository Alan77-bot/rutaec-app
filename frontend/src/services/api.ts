const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export async function apiGet<T>(endpoint: string): Promise<T> {
  const respuesta = await fetch(`${API_URL}${endpoint}`);

  if (!respuesta.ok) {
    throw new Error(`Error HTTP: ${respuesta.status}`);
  }

  return respuesta.json() as Promise<T>;
}