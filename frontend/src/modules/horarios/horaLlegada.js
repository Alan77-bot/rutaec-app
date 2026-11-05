export function horaLlegada(salida, paradas = []) {
  if (!/^\d{2}:\d{2}/.test(salida || '') || !paradas.length) return ''
  const [h,m] = salida.split(':').map(Number)
  const duracion = Math.max(...paradas.map(p => Number(p.minutos_desde_origen) || 0))
  const total = h*60+m+duracion
  return `${String(Math.floor(total/60)%24).padStart(2,'0')}:${String(total%60).padStart(2,'0')}${total>=1440 ? ` (+${Math.floor(total/1440)} ${Math.floor(total/1440)===1?'día':'días'})` : ''}`
}
