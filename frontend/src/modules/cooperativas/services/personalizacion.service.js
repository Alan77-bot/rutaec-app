export async function consultarPersonalizacion(id, signal) {
  return solicitar(id, { signal })
}

export async function guardarPersonalizacion(id, datos) {
  return solicitar(id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) })
}

async function solicitar(id, opciones) {
  const respuesta = await fetch(`/api/cooperativas/${encodeURIComponent(id)}/personalizacion`, { credentials: 'include', ...opciones })
  const cuerpo = await respuesta.json()
  if (!respuesta.ok) throw new Error(cuerpo.error || 'No se pudo consultar la personalización.')
  return cuerpo.datos
}
