import { RUTA_POR_ROL } from './usuarios.js'

export const esPersonal = rol => ['admin', 'cooperativa', 'oficinista'].includes(rol)
export const inicioPorRol = rol => RUTA_POR_ROL[rol] || '/'

export function cooperativaVisible(sesion, seleccion) {
  if (sesion?.rol === 'admin') return null
  if (['cooperativa', 'oficinista'].includes(sesion?.rol)) return sesion.coopId || null
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seleccion || '') ? seleccion : null
}
