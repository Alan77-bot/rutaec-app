const BASE = '/api'

export class ApiError extends Error {
  constructor(mensaje, estado = 0, campo = null) {
    super(mensaje)
    this.estado = estado
    this.campo = campo
  }
}

let token = null
try {
  token = localStorage.getItem('vy_token')
} catch {
  token = null
}

export const hayToken = () => Boolean(token)
export function guardarToken(t) {
  token = t
  try {
    if (t) localStorage.setItem('vy_token', t)
    else localStorage.removeItem('vy_token')
  } catch {
    /* sin almacenamiento disponible */
  }
}

async function pedir(ruta, { metodo = 'GET', cuerpo, form } = {}) {
  const cabeceras = {}
  if (token) cabeceras.Authorization = 'Bearer ' + token
  if (cuerpo) cabeceras['Content-Type'] = 'application/json'

  let r
  try {
    r = await fetch(BASE + ruta, { method: metodo, headers: cabeceras, body: form || (cuerpo ? JSON.stringify(cuerpo) : undefined) })
  } catch {
    throw new ApiError('No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.', 0)
  }
  const datos = await r.json().catch(() => null)
  if (!r.ok) {
    if (r.status === 401 && token && !ruta.startsWith('/auth/login')) window.dispatchEvent(new Event('vy:sesion-vencida'))
    throw new ApiError(datos?.error || 'Ocurrió un error inesperado.', r.status, datos?.campo || null)
  }
  return datos
}

export const api = {
  get: (ruta) => pedir(ruta),
  post: (ruta, cuerpo) => pedir(ruta, { metodo: 'POST', cuerpo: cuerpo ?? {} }),
  put: (ruta, cuerpo) => pedir(ruta, { metodo: 'PUT', cuerpo }),
  patch: (ruta, cuerpo) => pedir(ruta, { metodo: 'PATCH', cuerpo }),
  del: (ruta) => pedir(ruta, { metodo: 'DELETE' }),
  postForm: (ruta, form) => pedir(ruta, { metodo: 'POST', form }),
}

// Descarga un archivo protegido (el comprobante) y devuelve una URL temporal para mostrarlo.
export async function archivoProtegido(ruta) {
  const r = await fetch(BASE + ruta, { headers: token ? { Authorization: 'Bearer ' + token } : {} })
  if (!r.ok) throw new ApiError('No se pudo abrir el archivo.', r.status)
  const blob = await r.blob()
  return { url: URL.createObjectURL(blob), tipo: blob.type }
}
